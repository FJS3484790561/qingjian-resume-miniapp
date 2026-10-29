const {test}=require('node:test')
const assert=require('node:assert/strict')
const {harness}=require('./resume-test-harness.cjs')
const tick=async()=>{for(let n=0;n<20;n++)await Promise.resolve()}
async function setup(){
 const pending=[],disk=new Map()
 disk.set('qingyu-api-session:v1',{token:'a'.repeat(64),expiresAt:Date.now()+100000,user:{id:'ai-user',provider:'development'}})
 const h=harness('AiPage',{}, {getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k),request:o=>pending.push(o)})
 const api=h.load('backend')
 h.screen.service.value={enabled:true,provider:'测试服务商',model:'test-model'};await tick();h.screen.consent.value=true
 const reply=(statusCode,data)=>{const o=pending.shift();assert.ok(o,'expected API request');o.success({statusCode,data})}
 return {h,api,pending,reply}
}

test('real AI refuses missing configuration or consent and sends only the selected plain text after consent',async()=>{
 const {h,pending}=await setup()
 try{
  const p=h.screen;p.service.value.enabled=false;await p.generateReal();assert.equal(pending.length,0);assert.match(p.error.value,/未配置/)
  p.service.value.enabled=true;p.consent.value=false;await p.generateReal();assert.equal(pending.length,0);assert.match(p.error.value,/同意/)
  p.consent.value=true;const starting=p.generateReal();await tick()
  const body=pending[0].data;assert.equal(body.source.includes('<p>'),false);assert.equal(body.resume,undefined);assert.equal(body.photo,undefined)
  assert.equal(body.service.provider,'测试服务商');assert.equal(body.consent,true)
  pending.shift().fail({});await starting
 }finally{h.dispose()}
})

test('real AI locks repeat clicks and reuses request ID after losing the create response',async()=>{
 const {h,pending,reply}=await setup()
 try{
  const p=h.screen,original=p.target.value.content,starting=p.generateReal();p.generateReal();await tick();assert.equal(pending.length,1)
  const key=pending[0].data.requestId;pending.shift().fail({});await starting
  const retry=p.generateReal();await tick();assert.equal(pending[0].data.requestId,key)
  reply(200,{id:'ai-result',state:'running'});await retry;await tick()
  reply(200,{id:'ai-result',state:'complete',result:'经本人修改和确认的表达'});await tick()
  p.result.value='进一步手动修改';p.apply();assert.equal(p.applied.value,true);assert.notEqual(p.target.value.content,original)
  p.undo();assert.equal(p.target.value.content,original)
 }finally{h.dispose()}
})

test('hiding during real AI submission cancels a late job instead of showing or applying its result',async()=>{
 const {h,pending,reply}=await setup()
 try{
  const p=h.screen,original=JSON.stringify(h.store.state),starting=p.generateReal();await tick();h.fire('hide')
  reply(200,{id:'late-ai',state:'complete',result:'迟到结果'});await starting;await tick()
  assert.match(pending[0].url,/late-ai\/cancel$/);assert.equal(p.result.value,'');assert.equal(JSON.stringify(h.store.state),original)
  reply(200,{id:'late-ai',state:'complete'})
 }finally{h.dispose()}
})

test('real AI cancel and a later poll result cannot overwrite original content; changed entry blocks apply',async()=>{
 const {h,pending,reply}=await setup()
 try{
  const p=h.screen,original=p.target.value.content,starting=p.generateReal();reply(200,{id:'cancel-ai',state:'running'});await starting;await tick()
  p.cancelGeneration();const poll=pending.shift();assert.match(pending[0].url,/cancel$/)
  reply(200,{id:'cancel-ai',state:'cancelled'});poll.success({statusCode:200,data:{id:'cancel-ai',state:'complete',result:'迟到结果'}});await tick()
  assert.equal(p.result.value,'');assert.equal(p.target.value.content,original)
  const next=p.generateReal();reply(200,{id:'another-ai',state:'running'});await next;await tick()
  reply(200,{id:'another-ai',state:'complete',result:'正常结果'});await tick()
  const target=p.target.value;h.store.updateResume(r=>{r.modules[target.module].entries.find(e=>e.id===target.id).content='<p>稍后修改的正文</p>'})
  p.apply();assert.equal(p.applied.value,false);assert.match(p.error.value,/修改/)
 }finally{h.dispose()}
})

test('real AI result is cleared on account or draft change, including later query responses',async()=>{
 const {h,api,reply}=await setup()
 try{
  const p=h.screen,starting=p.generateReal();reply(200,{id:'old-account-job',state:'running'});await starting;await tick()
  api.account.session={...api.account.session,token:'b'.repeat(64)};await tick()
  reply(200,{id:'old-account-job',state:'complete',result:'另一个账号的结果'});await tick()
  assert.equal(p.result.value,'');assert.equal(p.consent.value,false);assert.equal(p.busy.value,false)
  p.result.value='暂存结果';h.store.createResume(true);await tick();assert.equal(p.result.value,'')
 }finally{h.dispose()}
})
