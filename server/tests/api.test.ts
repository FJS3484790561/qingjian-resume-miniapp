import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../app'
import { loadConfig, type Config } from '../config'
import { makeResume } from '../../src/features/resume/schema'
import { openDatabase } from '../database'

const config = (overrides: Partial<Config> = {}):Config => ({ ...loadConfig({}, true), database: ':memory:', ...overrides })
async function signIn(app: Awaited<ReturnType<typeof buildApp>>, deviceId='development-device-000001') {
  const response=await app.inject({method:'POST',url:'/v1/auth/development',payload:{deviceId}})
  assert.equal(response.statusCode,200,response.body)
  return response.json() as {token:string;expiresAt:number;user:{id:string;provider:string}}
}
const authorization=(token:string)=>({authorization:'Bearer '+token})
const draft=()=>{const resume=makeResume(true);resume.id='test-resume';return resume}

test('configuration prevents exposed development authentication and requires production credentials',()=>{
  assert.throws(()=>loadConfig({NODE_ENV:'production',ALLOW_DEV_LOGIN:'true'}),/开发登录/)
  assert.throws(()=>loadConfig({API_HOST:'0.0.0.0',ALLOW_DEV_LOGIN:'true'}),/开发登录/)
  assert.throws(()=>loadConfig({NODE_ENV:'production'}),/WECHAT_APP_SECRET/)
  assert.equal(loadConfig({}).developmentLogin,false)
  assert.throws(()=>loadConfig({API_PORT:'bad'}),/API_PORT/)
  assert.throws(()=>loadConfig({WECHAT_APP_ID:'wx-other-project'}),/AppID/)
  assert.deepEqual(loadConfig({CORS_ORIGINS:''}).origins,[])
})

test('development route is gated and remote requests cannot use it',async t=>{
  const app=await buildApp(config({developmentLogin:false}));t.after(()=>app.close())
  assert.equal((await app.inject({method:'POST',url:'/v1/auth/development',payload:{deviceId:'development-device-000001'}})).statusCode,404)
  const local=await buildApp(config());t.after(()=>local.close())
  assert.equal((await local.inject({method:'POST',url:'/v1/auth/development',remoteAddress:'192.168.1.2',payload:{deviceId:'development-device-000001'}})).statusCode,404)
})

test('proxy rate limits separate clients only through explicitly trusted loopback hops',async t=>{
  const app=await buildApp(config({trustLocalProxy:true,developmentLogin:false}));t.after(()=>app.close())
  const request=(ip:string,remoteAddress='127.0.0.1')=>app.inject({method:'POST',url:'/v1/auth/wechat',remoteAddress,headers:{'x-forwarded-for':ip},payload:{code:'test-code'}})
  for(let n=0;n<10;n++)assert.equal((await request('198.51.100.1')).statusCode,503)
  assert.equal((await request('198.51.100.1')).statusCode,429)
  assert.equal((await request('198.51.100.2')).statusCode,503)
  for(let n=0;n<10;n++)assert.equal((await request('198.51.100.'+(n+10),'192.0.2.50')).statusCode,503)
  assert.equal((await request('198.51.100.200','192.0.2.50')).statusCode,429)
  assert.equal(loadConfig({}).trustLocalProxy,false)
  assert.equal(loadConfig({TRUST_LOCAL_PROXY:'true'}).trustLocalProxy,true)
})

test('sessions isolate users, redact identity secrets, expire and revoke',async t=>{
  let now=1000
  const app=await buildApp(config(),{now:()=>now});t.after(()=>app.close())
  const a=await signIn(app),b=await signIn(app,'development-device-000002')
  assert.notEqual(a.user.id,b.user.id)
  assert.equal(a.user.provider,'development')
  assert.equal('subject' in a.user,false)
  assert.equal((await app.inject({url:'/v1/resumes'})).statusCode,401)
  const headers=authorization(a.token)
  assert.equal((await app.inject({url:'/v1/me',headers})).statusCode,200)
  assert.equal((await app.inject({method:'POST',url:'/v1/auth/logout',headers})).statusCode,200)
  assert.equal((await app.inject({url:'/v1/me',headers})).statusCode,401)
  now=b.expiresAt
  assert.equal((await app.inject({url:'/v1/me',headers:authorization(b.token)})).statusCode,401)
})

test('persistent draft roundtrip, ownership, optimistic concurrency and safe deletion',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'qingyu-api-'))
  const cfg=config({database:join(dir,'data.sqlite')})
  let app=await buildApp(cfg)
  t.after(async()=>{await app.close();rmSync(dir,{recursive:true,force:true})})
  const a=await signIn(app),b=await signIn(app,'development-device-000002'),resume=draft()
  const headers=authorization(a.token)
  let response=await app.inject({method:'PUT',url:'/v1/resumes/'+resume.id,headers,payload:{resume,expectedRevision:0}})
  assert.equal(response.statusCode,200,response.body);assert.equal(response.json().revision,1)
  const oldRevision=response.json().revision
  resume.title='已更新的测试简历'
  response=await app.inject({method:'PUT',url:'/v1/resumes/'+resume.id,headers,payload:{resume,expectedRevision:1}})
  assert.equal(response.json().revision,2)
  response=await app.inject({method:'PUT',url:'/v1/resumes/'+resume.id,headers,payload:{resume,expectedRevision:oldRevision}})
  assert.equal(response.statusCode,409)
  for(const method of ['GET','DELETE'] as const){
    response=await app.inject({method,url:'/v1/resumes/'+resume.id,headers:authorization(b.token),...(method==='DELETE'?{payload:{expectedRevision:2}}:{})})
    assert.equal(response.statusCode,404)
  }
  assert.deepEqual((await app.inject({url:'/v1/resumes',headers:authorization(b.token)})).json().resumes,[])
  await app.close();app=await buildApp(cfg)
  response=await app.inject({url:'/v1/resumes/'+resume.id,headers})
  assert.equal(response.statusCode,200);assert.equal(response.json().resume.title,resume.title)
  assert.equal(response.json().revision,2)
  assert.equal((await app.inject({method:'DELETE',url:'/v1/resumes/'+resume.id,headers,payload:{expectedRevision:1}})).statusCode,409)
  assert.equal((await app.inject({method:'DELETE',url:'/v1/resumes/'+resume.id,headers,payload:{expectedRevision:2}})).statusCode,200)
  assert.equal((await app.inject({url:'/v1/resumes/'+resume.id,headers})).statusCode,404)
  // A delayed write must not resurrect a deleted resume.
  assert.equal((await app.inject({method:'PUT',url:'/v1/resumes/'+resume.id,headers,payload:{resume,expectedRevision:2}})).statusCode,409)
  assert.equal((await app.inject({method:'PUT',url:'/v1/resumes/'+resume.id,headers,payload:{resume,expectedRevision:0}})).statusCode,409)
})

test('validation rejects malformed, oversized and local-photo payloads; rich text is sanitized',async t=>{
  const app=await buildApp(config());t.after(()=>app.close())
  const {token}=await signIn(app),headers=authorization(token)
  const save=(resume:any)=>app.inject({method:'PUT',url:'/v1/resumes/'+resume.id,headers,payload:{resume,expectedRevision:0}})
  const photo=draft();photo.basic.photo='wxfile://private.png';assert.equal((await save(photo)).statusCode,400)
  const order=draft();order.order.fill('work');assert.equal((await save(order)).statusCode,400)
  const unknown=draft() as any;unknown.member=true;assert.equal((await save(unknown)).statusCode,400)
  const title=draft();title.title='';assert.equal((await save(title)).statusCode,400)
  const duplicate=draft();duplicate.modules.project.entries.push({...duplicate.modules.project.entries[0]});assert.equal((await save(duplicate)).statusCode,400)
  const long=draft();long.modules.project.entries[0].content='x'.repeat(600000);assert.equal((await save(long)).statusCode,413)
  const resume=draft();resume.modules.project.entries[0].content='<p onclick="alert(1)">成果<strong>清晰</strong><script>alert(1)</script><img src="https://evil.test/pixel"></p>'
  assert.equal((await save(resume)).statusCode,200)
  const saved=(await app.inject({url:'/v1/resumes/'+resume.id,headers})).json().resume
  assert.equal(saved.modules.project.entries[0].content,'<p>成果<strong>清晰</strong></p>')
})

test('account deletion removes all backups and all sessions, without affecting another user',async t=>{
  const app=await buildApp(config());t.after(()=>app.close())
  const a=await signIn(app),a2=await signIn(app),b=await signIn(app,'development-device-000002'),resume=draft()
  await app.inject({method:'PUT',url:'/v1/resumes/'+resume.id,headers:authorization(a.token),payload:{resume,expectedRevision:0}})
  assert.equal((await app.inject({method:'DELETE',url:'/v1/me',headers:authorization(a.token),payload:{confirmation:'wrong'}})).statusCode,400)
  assert.equal((await app.inject({method:'DELETE',url:'/v1/me',headers:authorization(a.token),payload:{confirmation:'DELETE_MY_ACCOUNT'}})).statusCode,200)
  assert.equal((await app.inject({url:'/v1/me',headers:authorization(a2.token)})).statusCode,401)
  assert.equal((await app.inject({url:'/v1/me',headers:authorization(b.token)})).statusCode,200)
  const recreated=await signIn(app);assert.notEqual(recreated.user.id,a.user.id)
  assert.equal((await app.inject({url:'/v1/resumes',headers:authorization(recreated.token)})).json().resumes.length,0)
})

test('WeChat exchange keeps app secret and session_key server-side, never falls back to development',async t=>{
  let requested:URL|undefined
  const app=await buildApp(config({appSecret:'test-only-secret'}),{fetcher:async input=>{
    requested=input as URL
    return new Response(JSON.stringify({openid:'wechat-user',session_key:'private-session-key'}),{status:200})
  }});t.after(()=>app.close())
  const response=await app.inject({method:'POST',url:'/v1/auth/wechat',payload:{code:'temporary-code'}})
  assert.equal(response.statusCode,200);assert.equal(response.json().user.provider,'wechat')
  assert.equal(requested?.hostname,'api.weixin.qq.com')
  assert.equal(requested?.searchParams.get('appid'),'wxdccead0ec32190d0')
  for(const privateValue of ['test-only-secret','private-session-key','wechat-user'])assert.equal(response.body.includes(privateValue),false)
  const unavailable=await buildApp(config());t.after(()=>unavailable.close())
  assert.equal((await unavailable.inject({method:'POST',url:'/v1/auth/wechat',payload:{code:'code'}})).statusCode,503)
  const invalid=await buildApp(config({appSecret:'test'}),{fetcher:async()=>new Response(JSON.stringify({errcode:40029,errmsg:'secret response'}))});t.after(()=>invalid.close())
  const failure=await invalid.inject({method:'POST',url:'/v1/auth/wechat',payload:{code:'expired'}})
  assert.equal(failure.statusCode,401);assert.equal(failure.body.includes('secret response'),false)
})

test('authentication is rate limited and health is non-cacheable',async t=>{
  const app=await buildApp(config());t.after(()=>app.close())
  const health=await app.inject({url:'/health'})
  assert.equal(health.headers['cache-control'],'no-store')
  assert.equal(health.json().developmentLogin,true)
  for(let n=0;n<10;n++)await signIn(app)
  assert.equal((await app.inject({method:'POST',url:'/v1/auth/development',payload:{deviceId:'development-device-000001'}})).statusCode,429)
})

test('database migrations create the current schema',async()=>{
  const db=openDatabase(':memory:')
  try{assert.equal((db.prepare('PRAGMA user_version').get() as any).user_version,4)}finally{db.close()}
})
