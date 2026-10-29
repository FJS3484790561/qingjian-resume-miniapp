import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setImmediate as tick, setTimeout as delay } from 'node:timers/promises'
import { buildApp } from '../app'
import { loadConfig } from '../config'
import { createAiRunner } from '../ai'
import { openDatabase } from '../database'

const config = () => ({ ...loadConfig({ AI_API_ENDPOINT: 'https://ai.example.test/v1/chat/completions', AI_API_KEY: 'private-test-key',
  AI_MODEL: 'test-model', AI_PROVIDER_LABEL: '测试服务商' }, true), database: ':memory:' })
const payload = (requestId = 'request-1') => ({ requestId, source: '负责整理需求与跟进开发。', section: '工作经历', consent: true,
  service: { provider: '测试服务商', model: 'test-model' } })
async function signIn(app: Awaited<ReturnType<typeof buildApp>>, suffix = '01') {
  const response = await app.inject({ method: 'POST', url: '/v1/auth/development', payload: { deviceId: 'ai-test-device-000000' + suffix } })
  assert.equal(response.statusCode, 200)
  return { authorization: 'Bearer ' + response.json().token }
}
async function settle(app: Awaited<ReturnType<typeof buildApp>>, headers: Record<string,string>, id: string) {
  for (let n = 0; n < 20; n++) {
    await tick()
    const value = (await app.inject({ url: '/v1/ai/jobs/' + id, headers })).json()
    if (!['running','queued'].includes(value.state)) return value
  }
  assert.fail('task did not reach a terminal state')
}

test('AI configuration requires HTTPS and does not expose endpoint or key; disabled service never calls provider', async t => {
  for (const endpoint of ['http://ai.test/v1','https://user:key@ai.test/v1','https://ai.test/v1?key=secret']) assert.throws(() => loadConfig({ AI_API_ENDPOINT: endpoint }))
  let calls = 0
  const app = await buildApp({ ...loadConfig({},true), database: ':memory:' }, { aiRunner: async () => { calls++; return { text:'unused',inputTokens:0,outputTokens:0 } } })
  t.after(() => app.close())
  const headers = await signIn(app)
  assert.equal((await app.inject({ method:'POST',url:'/v1/ai/jobs',headers,payload:payload() })).statusCode,503)
  assert.equal(calls,0)
  assert.deepEqual((await app.inject('/v1/ai/service')).json(), {enabled:false,provider:'',model:''})
})

test('AI jobs require consent, isolate accounts, deduplicate retries and record actual provider tokens', async t => {
  let calls = 0
  const app = await buildApp(config(), { aiRunner: async () => { calls++; return { text:'整理需求，跟进开发进度。',inputTokens:21,outputTokens:12 } } })
  t.after(() => app.close())
  const headers = await signIn(app), other = await signIn(app,'02')
  const post = (body:any) => app.inject({ method:'POST',url:'/v1/ai/jobs',headers,payload:body })
  assert.equal((await app.inject({method:'POST',url:'/v1/ai/jobs',payload:payload()})).statusCode,401)
  assert.equal((await post({...payload(),consent:false})).statusCode,400)
  assert.equal((await post({...payload(),endpoint:'https://evil.test'})).statusCode,400)
  assert.equal((await post({...payload(),service:{provider:'另一个服务商',model:'test-model'}})).statusCode,409)
  const created = await post(payload()); assert.equal(created.statusCode,200,created.body)
  const id = created.json().id
  assert.equal((await post(payload())).json().id,id)
  assert.equal((await post({...payload(),source:'不同正文'})).statusCode,409)
  assert.equal((await app.inject({url:'/v1/ai/jobs/'+id,headers:other})).statusCode,404)
  assert.equal((await app.inject({method:'POST',url:'/v1/ai/jobs/'+id+'/cancel',headers:other})).statusCode,404)
  const result = await settle(app,headers,id)
  assert.equal(result.state,'complete'); assert.equal(result.result,'整理需求，跟进开发进度。'); assert.equal('source' in result,false)
  const usage = (await app.inject({url:'/v1/ai/usage',headers})).json()
  assert.equal(usage.attempts,1); assert.equal(usage.inputTokens,21); assert.equal(usage.outputTokens,12); assert.equal(calls,1)
  const service = (await app.inject('/v1/ai/service')).body
  assert.equal(service.includes('private-test-key'),false); assert.equal(service.includes('https://'),false)
})

test('AI cancellation wins over late output, permits another request and enforces the technical attempt limit', async t => {
  let finish!: (value:any) => void
  const cfg=config(); cfg.ai.dailyLimit=2
  const app=await buildApp(cfg,{aiRunner:()=>new Promise(resolve=>{finish=resolve})});t.after(()=>app.close())
  const headers=await signIn(app)
  const create=()=>app.inject({method:'POST',url:'/v1/ai/jobs',headers,payload:payload()})
  const first=(await create()).json(); await tick()
  assert.equal((await app.inject({method:'POST',url:'/v1/ai/jobs',headers,payload:payload('request-2')})).statusCode,409)
  const cancelled=await app.inject({method:'POST',url:'/v1/ai/jobs/'+first.id+'/cancel',headers,payload:{}})
  assert.equal(cancelled.json().state,'cancelled')
  finish({text:'迟到的结果',inputTokens:1,outputTokens:1});await tick()
  assert.equal((await settle(app,headers,first.id)).result,'')
  const second=(await app.inject({method:'POST',url:'/v1/ai/jobs',headers,payload:payload('request-2')})).json()
  await tick(); await app.inject({method:'POST',url:'/v1/ai/jobs/'+second.id+'/cancel',headers,payload:{}});await tick()
  assert.equal((await app.inject({method:'POST',url:'/v1/ai/jobs',headers,payload:payload('request-3')})).statusCode,429)
  assert.equal((await create()).json().id,first.id)
})

test('AI account deletion aborts in-flight work; restart fails interrupted work and purges old private text', async t => {
  const directory=mkdtempSync(join(tmpdir(),'qingyu-ai-')),cfg={...config(),database:join(directory,'data.sqlite')}
  let app=await buildApp(cfg,{aiRunner:()=>new Promise(()=>{})})
  t.after(async()=>{await app.close();rmSync(directory,{recursive:true,force:true})})
  const headers=await signIn(app)
  const created=(await app.inject({method:'POST',url:'/v1/ai/jobs',headers,payload:payload()})).json()
  await tick()
  await app.inject({method:'DELETE',url:'/v1/me',headers,payload:{confirmation:'DELETE_MY_ACCOUNT'}})
  await app.close()
  const db=openDatabase(cfg.database)
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM ai_jobs').get() as any).n,0)
  db.close()
  app=await buildApp(cfg)
  const next=await signIn(app)
  const user=(await app.inject({url:'/v1/me',headers:next})).json().user.id
  await app.close()
  const seed=openDatabase(cfg.database),old=Date.now()-2*86400000
  seed.prepare("INSERT INTO ai_jobs(id,user_id,request_id,digest,state,source,section,result,created_at,updated_at) VALUES(?,?,?,?,'running','私有正文','测试','',?,?)")
    .run(created.id,user,'interrupted','hash',old,old)
  seed.prepare("INSERT INTO ai_jobs(id,user_id,request_id,digest,state,source,section,result,created_at,updated_at) VALUES(?,?,?,?,'complete','','测试','过期结果',?,?)")
    .run('expired',user,'old-request','hash',old,old)
  seed.close()
  app=await buildApp(cfg)
  const interrupted=(await app.inject({url:'/v1/ai/jobs/'+created.id,headers:next})).json()
  assert.equal(interrupted.state,'failed')
  const expired=(await app.inject({url:'/v1/ai/jobs/expired',headers:next})).json()
  assert.equal(expired.expired,true);assert.equal(expired.result,'')
})

test('AI deadline releases a stalled provider without storing a fabricated result or raw upstream error', async t => {
  const cfg=config(); cfg.ai.timeoutMs=1000
  const app=await buildApp(cfg,{aiRunner:()=>new Promise(()=>{})});t.after(()=>app.close())
  const headers=await signIn(app)
  const value=(await app.inject({method:'POST',url:'/v1/ai/jobs',headers,payload:payload()})).json()
  await delay(1100)
  const job=await settle(app,headers,value.id)
  assert.equal(job.state,'failed');assert.equal(job.result,'');assert.match(job.error,/超时/)
})

test('OpenAI-compatible adapter sends only selected text, bounds response, rejects truncated output and hides upstream errors', async () => {
  let body:any,options:RequestInit|undefined
  const runner=createAiRunner(config().ai,async (_url,init)=>{
    options=init;body=JSON.parse(String(init?.body))
    return new Response(JSON.stringify({choices:[{message:{content:'保留事实的建议'},finish_reason:'stop'}],usage:{prompt_tokens:3,completion_tokens:7}}))
  })
  assert.deepEqual(await runner({source:'选择的正文',section:'工作经历'},new AbortController().signal),{text:'保留事实的建议',inputTokens:3,outputTokens:7})
  assert.equal(options?.redirect,'error');assert.deepEqual(JSON.parse(body.messages[1].content),{source:'选择的正文',section:'工作经历'})
  for(const response of [new Response(JSON.stringify({choices:[{message:{content:'截断'},finish_reason:'length'}]})),new Response('x'.repeat(130*1024)),new Response('上游含密钥的错误',{status:401})]) {
    const invalid=createAiRunner(config().ai,async()=>response)
    await assert.rejects(()=>invalid({source:'正文',section:'工作'},new AbortController().signal),e=>!String(e).includes('密钥'))
  }
})
