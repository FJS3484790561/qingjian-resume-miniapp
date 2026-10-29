// Optional real-engine QA. Uses fictional data and an isolated in-memory account, never user drafts.
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {buildApp} from '../app'
import {loadConfig} from '../config'
import {makeResume} from '../../src/features/resume/schema'
const output=resolve('server/data/qa')
mkdirSync(output,{recursive:true})
async function verify(){
const app=await buildApp({...loadConfig({},true),database:':memory:'})
try {
 const session=(await app.inject({method:'POST',url:'/v1/auth/development',payload:{deviceId:'isolated-render-verification'}})).json()
 const headers={authorization:'Bearer '+session.token}
 const image=await sharp(Buffer.from('<svg width="295" height="413" xmlns="http://www.w3.org/2000/svg"><rect width="295" height="413" fill="#dce9e1"/><circle cx="147" cy="135" r="62" fill="#739483"/><path d="M30 413V325a117 117 0 0 1 234 0v88" fill="#739483"/><text x="147" y="390" text-anchor="middle" font-size="24" fill="white">QA SAMPLE</text></svg>')).png().toBuffer()
 const asset=await app.inject({method:'POST',url:'/v1/photos',headers,payload:{dataUrl:'data:image/png;base64,'+image.toString('base64')}})
 assert.equal(asset.statusCode,200,asset.body)
 const report=[]
 for(const [index,template] of ['clear','space','order'].entries()) {
  const resume=makeResume(true);resume.title='文件验收样例-'+template;resume.basic.photoId=asset.json().id
  resume.layout.templateId=template;resume.layout.cover=['quiet','arch','line'][index];resume.layout.font=index===2?4:2
  resume.modules.project.entries[0].content='<p><strong>加粗成果</strong>与<em>斜体说明</em>，<u>下划线保留</u>。</p><ol><li>第一项工作成果</li><li>第二项工作成果</li></ol>'+Array.from({length:35},(_,i)=>`<p>第${String(i+1).padStart(2,'0')}项：参与用户访谈与方案迭代，梳理关键操作路径，协助完成页面原型和交互说明。持续记录研究发现、设计决策及落地结果。</p>`).join('')+'<p>全文结束标记：青屿文件验收。</p>'
  for(const format of ['pdf','docx'] as const) {
   const created=await app.inject({method:'POST',url:'/v1/exports',headers,payload:{resume,format,requestId:'qa-'+template+'-'+format}})
   assert.equal(created.statusCode,202,created.body);const id=created.json().id
   let record
   for(let n=0;n<400;n++){record=(await app.inject({url:'/v1/exports/'+id,headers})).json();if(!['queued','running'].includes(record.state))break;await new Promise(r=>setTimeout(r,150))}
   assert.equal(record.state,'complete',JSON.stringify(record))
   const file=await app.inject({url:'/v1/exports/'+id+'/file',headers});assert.equal(file.statusCode,200)
   const bytes=file.rawPayload
   assert.equal(bytes.subarray(0,format==='pdf'?5:2).toString(),format==='pdf'?'%PDF-':'PK')
   writeFileSync(resolve(output,template+'.'+format),bytes)
   report.push({template,format,bytes:bytes.length,downloaded:true})
   console.log(`${template}.${format}: ${bytes.length} bytes, real engine + authenticated download passed`)
  }
 }
 writeFileSync(resolve(output,'render-report.json'),JSON.stringify({fictionalData:true,generatedAt:new Date().toISOString(),files:report},null,2))
} finally {await app.close()}
}
verify().catch(error=>{console.error(error);process.exitCode=1})
