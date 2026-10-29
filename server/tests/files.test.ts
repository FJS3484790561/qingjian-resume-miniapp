import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import sharp from 'sharp'
import {buildApp} from '../app'
import {loadConfig} from '../config'
import {openDatabase} from '../database'
import {makeResume} from '../../src/features/resume/schema'
import {documentHtml} from '../render'
import type {Renderer} from '../files'
const config=()=>({...loadConfig({},true),database:':memory:'})
type App=Awaited<ReturnType<typeof buildApp>>
async function login(app:App,deviceId='file-test-device-000001') {
 const r=await app.inject({method:'POST',url:'/v1/auth/development',payload:{deviceId}})
 assert.equal(r.statusCode,200);return {authorization:'Bearer '+r.json().token}
}
async function photo(app:App,headers:Record<string,string>) {
 const bytes=await sharp({create:{width:59,height:83,channels:3,background:'#739c8c'}}).png().toBuffer()
 return app.inject({method:'POST',url:'/v1/photos',headers,payload:{dataUrl:'data:image/png;base64,'+bytes.toString('base64')}})
}
async function settled(app:App,id:string,headers:Record<string,string>) {
 for(let n=0;n<200;n++){const row=(await app.inject({url:'/v1/exports/'+id,headers})).json();if(!['queued','running'].includes(row.state))return row;await new Promise(r=>setTimeout(r,10))}
 throw new Error('job did not settle')
}
test('private photos are normalized, deduplicated, owned, validated and protected while referenced',async t=>{
 const app=await buildApp(config());t.after(()=>app.close());const a=await login(app),b=await login(app,'file-test-device-000002')
 const created=await photo(app,a);assert.equal(created.statusCode,200,created.body);const id=created.json().id
 assert.equal((await photo(app,a)).json().id,id)
 const get=await app.inject({url:'/v1/photos/'+id,headers:a});assert.match(get.json().dataUrl,/^data:image\/png;base64,/)
 assert.equal(get.headers['cache-control'],'no-store')
 assert.deepEqual((await app.inject({url:'/v1/photos',headers:b})).json().photos,[])
 for(const method of ['GET','DELETE'] as const)assert.equal((await app.inject({method,url:'/v1/photos/'+id,headers:b})).statusCode,404)
 const invalid=await app.inject({method:'POST',url:'/v1/photos',headers:a,payload:{dataUrl:'data:image/png;base64,dGhpcyBpcyBub3QgYW4gaW1hZ2U='}});assert.equal(invalid.statusCode,400)
 const r=makeResume(true);r.basic.photoId=id
 const save=(headers:Record<string,string>,revision:number)=>app.inject({method:'PUT',url:'/v1/resumes/'+r.id,headers,payload:{resume:r,expectedRevision:revision}})
 assert.equal((await save(b,0)).statusCode,400);assert.equal((await save(a,0)).statusCode,200)
 assert.equal((await app.inject({method:'DELETE',url:'/v1/photos/'+id,headers:a})).statusCode,409)
 delete r.basic.photoId;assert.equal((await save(a,1)).statusCode,200)
 assert.equal((await app.inject({method:'DELETE',url:'/v1/photos/'+id,headers:a})).statusCode,200)
})
test('export idempotency, binary permissions, history and deletion operate on persisted files',async t=>{
 const app=await buildApp(config(),{renderer:async()=>Buffer.from('%PDF-test-file')});t.after(()=>app.close())
 const a=await login(app),b=await login(app,'file-test-device-000002'),resume=makeResume(true)
 const create=()=>app.inject({method:'POST',url:'/v1/exports',headers:a,payload:{resume,format:'pdf',requestId:'unique-request'}})
 const first=await create();assert.equal(first.statusCode,202,first.body);const id=first.json().id
 assert.equal((await create()).json().id,id);assert.equal((await settled(app,id,a)).state,'complete')
 assert.equal((await app.inject({url:'/v1/exports',headers:a})).json().exports.length,1)
 const file=await app.inject({url:'/v1/exports/'+id+'/file',headers:a});assert.equal(file.body,'%PDF-test-file');assert.equal(file.headers['content-type'],'application/pdf');assert.match(String(file.headers['content-disposition']),/filename\*=UTF-8/)
 for(const url of ['/v1/exports/'+id,'/v1/exports/'+id+'/file'])assert.equal((await app.inject({url,headers:b})).statusCode,404)
 assert.equal((await app.inject({url:'/v1/exports/'+id+'/file'})).statusCode,401)
 resume.title='变更输入';assert.equal((await create()).statusCode,409)
 assert.equal((await app.inject({method:'POST',url:'/v1/exports/'+id+'/cancel',headers:a})).statusCode,409)
 assert.equal((await app.inject({method:'DELETE',url:'/v1/exports/'+id,headers:a})).statusCode,200)
 assert.equal((await app.inject({url:'/v1/exports/'+id+'/file',headers:a})).statusCode,404)
 assert.deepEqual((await app.inject({url:'/v1/exports',headers:a})).json().exports,[])
})
test('cancel and account deletion defeat late file completion without changing other accounts',async t=>{
 let resolve!:(value:Buffer)=>void
 const renderer:Renderer=()=>new Promise(r=>{resolve=r})
 const app=await buildApp(config(),{renderer});t.after(()=>app.close());const a=await login(app),b=await login(app,'file-test-device-000002')
 const created=await app.inject({method:'POST',url:'/v1/exports',headers:a,payload:{resume:makeResume(true),format:'pdf',requestId:'cancel-test'}});const id=created.json().id
 assert.equal((await app.inject({method:'POST',url:'/v1/exports/'+id+'/cancel',headers:a})).json().state,'cancelled')
 resolve(Buffer.from('late-file'));await new Promise(r=>setTimeout(r,10))
 assert.equal((await app.inject({url:'/v1/exports/'+id,headers:a})).json().state,'cancelled')
 assert.equal((await app.inject({url:'/v1/exports/'+id+'/file',headers:a})).statusCode,409)
 await photo(app,a)
 const another=await app.inject({method:'POST',url:'/v1/exports',headers:a,payload:{resume:makeResume(true),format:'docx',requestId:'delete-account-test'}})
 assert.equal(another.statusCode,202)
 assert.equal((await app.inject({method:'DELETE',url:'/v1/me',headers:a,payload:{confirmation:'DELETE_MY_ACCOUNT'}})).statusCode,200)
 resolve(Buffer.from('late-again'));await new Promise(r=>setTimeout(r,10))
 assert.deepEqual((await app.inject({url:'/v1/exports',headers:b})).json().exports,[])
 assert.equal((await app.inject({url:'/v1/photos',headers:a})).statusCode,401)
})
test('failed rendering is retryable with a new request and never exposes a false file',async t=>{
 const app=await buildApp(config(),{renderer:async()=>{throw new Error('private engine failure')}});t.after(()=>app.close());const headers=await login(app)
 const response=await app.inject({method:'POST',url:'/v1/exports',headers,payload:{resume:makeResume(true),format:'pdf',requestId:'failure-test'}})
 const row=await settled(app,response.json().id,headers);assert.equal(row.state,'failed');assert.doesNotMatch(row.error,/private engine/)
 assert.equal((await app.inject({url:'/v1/exports/'+row.id+'/file',headers})).statusCode,409)
})
test('restart marks interrupted jobs failed, retains existing users, photos and completed blobs',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'qingyu-files-')),cfg={...config(),database:join(directory,'files.sqlite')}
 let app=await buildApp(cfg,{renderer:async()=>Buffer.from('persisted-file')});t.after(async()=>{await app.close();rmSync(directory,{recursive:true,force:true})})
 const headers=await login(app);const created=await photo(app,headers)
 const job=await app.inject({method:'POST',url:'/v1/exports',headers,payload:{resume:makeResume(true),format:'docx',requestId:'persist-test'}});await settled(app,job.json().id,headers)
 await app.close()
 const db=openDatabase(cfg.database),user=db.prepare('SELECT id FROM users').get() as {id:string}
 db.prepare("INSERT INTO exports(id,user_id,request_id,digest,title,format,state,snapshot,created_at,updated_at) VALUES('interrupted',?,'interrupted','hash','title','pdf','running','{}',1,1)").run(user.id);db.close()
 app=await buildApp(cfg)
 assert.equal((await app.inject({url:'/v1/exports/interrupted',headers})).json().state,'failed')
 assert.equal((await app.inject({url:'/v1/exports/'+job.json().id+'/file',headers})).body,'persisted-file')
 assert.equal((await app.inject({url:'/v1/photos/'+created.json().id,headers})).statusCode,200)
})
test('PDF source escapes metadata, blocks remote resources and retains full long rich content',()=>{
 const resume=makeResume(true);resume.basic.name='<script>bad()</script>';resume.modules.project.entries[0].content='<p><strong>'+('长内容'.repeat(400))+'</strong></p>'
 const html=documentHtml({resume,format:'pdf'})
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('<strong>'+('长内容'.repeat(400))+'</strong>'))
 assert.match(html,/default-src 'none'/);assert.doesNotMatch(html,/<script>/)
})
test('pending export limits, readiness and cancellation do not invent files or run cancelled queued jobs',async t=>{
 let release!:(value:Buffer)=>void,calls=0
 const gate=new Promise<Buffer>(resolve=>{release=resolve})
 const app=await buildApp(config(),{renderer:async()=>{calls++;return gate}});t.after(()=>app.close());const headers=await login(app)
 const resume=makeResume(true),ids=[]
 for(let n=0;n<3;n++){const r=await app.inject({method:'POST',url:'/v1/exports',headers,payload:{resume,format:'pdf',requestId:'queue-'+n}});assert.equal(r.statusCode,202);ids.push(r.json().id)}
 assert.equal((await app.inject({method:'POST',url:'/v1/exports',headers,payload:{resume,format:'pdf',requestId:'queue-overflow'}})).statusCode,429)
 assert.equal((await app.inject({url:'/v1/exports/'+ids[0]+'/file',headers})).statusCode,409)
 assert.equal((await app.inject({method:'DELETE',url:'/v1/exports/'+ids[0],headers})).statusCode,409)
 assert.equal((await app.inject({method:'POST',url:'/v1/exports/'+ids[2]+'/cancel',headers})).json().state,'cancelled')
 release(Buffer.from('ready-file'))
 assert.equal((await settled(app,ids[0],headers)).state,'complete');assert.equal((await settled(app,ids[1],headers)).state,'complete')
 assert.equal((await settled(app,ids[2],headers)).state,'cancelled');assert.equal(calls,2)
})
