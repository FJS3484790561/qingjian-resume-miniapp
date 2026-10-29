const {test}=require('node:test')
const assert=require('node:assert/strict')
const {harness}=require('./resume-test-harness.cjs')
const tick=async()=>{for(let n=0;n<20;n++)await Promise.resolve()}
function setup(props={},overrides={}){
 const pending=[],disk=new Map()
 disk.set('qingyu-api-session:v1',{token:'a'.repeat(64),expiresAt:Date.now()+100000,user:{id:'file-client-user',provider:'development'}})
 const h=harness('RealExportPage',props, {getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k),request:o=>pending.push(o),...overrides})
 const api=h.load('backend')
 const reply=(statusCode,data)=>{const o=pending.shift();assert.ok(o);o.success({statusCode,data})}
 return {h,api,pending,reply}
}
test('real export freezes saved content, locks duplicate clicks and retries a lost response with the same key',async()=>{
 const s=setup(),{h}=s
 try{
  const starting=h.screen.start();h.screen.start();await tick();assert.equal(s.pending.length,1)
  const input=s.pending[0].data,requestId=input.requestId,title=input.resume.title
  h.store.updateResume(r=>{r.title='生成后继续编辑'})
  s.pending.shift().fail({});await starting
  assert.equal(h.screen.busy.value,false);assert.ok(h.screen.error.value)
  const retry=h.screen.start();await tick();assert.equal(s.pending[0].data.requestId,requestId);assert.equal(s.pending[0].data.resume.title,title)
  s.reply(200,{id:'real-file',title,state:'complete',format:'pdf',size:100});await tick()
  s.reply(200,{id:'real-file',title,state:'complete',format:'pdf',size:100});await retry
  assert.equal(h.screen.record.value.state,'complete');assert.equal(h.store.state.exports.length,0)
 }finally{h.dispose()}
})
test('explicit cancel waits for in-flight creation, and a late completion cannot become cancelled success',async()=>{
 const s=setup(),{h}=s
 try{
  const starting=h.screen.start();await tick();await h.screen.cancel()
  assert.match(h.screen.feedback.value,/等待/)
  s.reply(202,{id:'cancel-file',state:'running',format:'pdf'});await tick()
  assert.match(s.pending[0].url,/cancel$/)
  s.reply(409,{error:{code:'ALREADY_COMPLETE',message:'文件已完成，可在下载记录查看或删除'}});await tick()
  s.reply(200,{id:'cancel-file',state:'complete',format:'pdf',size:200});await starting;await tick()
  assert.equal(h.screen.record.value.state,'complete');assert.doesNotMatch(h.screen.feedback.value,/不会发布/)
 }finally{h.dispose()}
})
test('leaving ignores a late creation response and stops polling without mutating local drafts',async()=>{
 const s=setup(),{h}=s
 try{
  const before=JSON.stringify(h.store.state),starting=h.screen.start();await tick()
  h.fire('hide');s.reply(202,{id:'background-file',state:'running',format:'pdf'});await starting
  assert.equal(h.screen.record.value,null);assert.equal(s.pending.length,0);assert.equal(JSON.stringify(h.store.state),before)
 }finally{h.dispose()}
})
test('private photo upload cannot flow into a different account after a session switch',async()=>{
 const s=setup(),{h,api}=s
 try{
  const resume=JSON.parse(JSON.stringify(h.store.currentResume.value));resume.basic.photo='data:image/png;base64,dGVzdA=='
  const snapshot=api.snapshotForServer(resume).catch(e=>e)
  api.account.session={...api.account.session,token:'b'.repeat(64),user:{id:'other-user',provider:'development'}}
  s.reply(200,{id:'old-account-photo'})
  assert.match((await snapshot).message,/账号已变化/);assert.equal(s.pending.length,0)
 }finally{h.dispose()}
})
test('switching drafts or accounts discards cached jobs and ignores earlier polling results',async()=>{
 const s=setup(),{h,api}=s
 try{
  const starting=h.screen.start();await tick();s.reply(202,{id:'old-draft-job',title:'原草稿',state:'running',format:'pdf'});await tick()
  h.fire('hide');h.store.createResume(true);h.fire('show')
  assert.equal(h.screen.record.value,null)
  s.reply(200,{id:'old-draft-job',title:'原草稿',state:'complete',format:'pdf'});await starting
  assert.equal(h.screen.record.value,null)
  h.screen.record.value={id:'old-user-job',title:'旧账号文档',state:'complete',format:'pdf'}
  api.account.session=null;await tick();assert.equal(h.screen.record.value,null)
 }finally{h.dispose()}
})
test('Word template generation uses fictional content and never uploads the active private draft',async()=>{
 const s=setup({type:'word',selected:'order'}),{h}=s
 try{
  h.store.updateResume(r=>{r.basic.name='PRIVATE NAME';r.basic.photo='data:image/png;base64,cHJpdmF0ZQ==';r.title='PRIVATE DRAFT'})
  const before=JSON.stringify(h.store.state),starting=h.screen.start();await tick()
  const body=s.pending[0].data
  assert.equal(body.format,'docx');assert.equal(body.resume.basic.name,'林知夏');assert.equal(body.resume.basic.photoId,undefined)
  assert.equal(body.resume.layout.templateId,'order');assert.equal(body.resume.layout.color,'#456587')
  assert.doesNotMatch(JSON.stringify(body),/PRIVATE/)
  h.fire('hide');s.reply(202,{id:'example-word',state:'running',format:'docx'});await starting
  assert.equal(JSON.stringify(h.store.state),before)
 }finally{h.dispose()}
})
test('a late native download cannot open a document after leaving the page',async()=>{
 let download,opened=0
 const s=setup({}, {downloadFile:o=>{download=o},openDocument:()=>{opened++}}),{h}=s
 try{
  h.screen.record.value={id:'ready-document',title:'可下载文件',format:'pdf',state:'complete',size:100}
  const operation=h.screen.open();assert.ok(download);h.fire('hide')
  download.success({statusCode:200,tempFilePath:'wxfile://downloaded.pdf'});await operation
  assert.equal(opened,0);assert.equal(h.store.state.exports.length,0)
 }finally{h.dispose()}
})
