// Real WeChat simulator UI -> configured API -> private persistence and document engine.
// No login/API mocks, no user draft deletion, no AI calls or payments.
// QINGYU_BACKEND_TARGET describes the independently checked transport, not a health claim.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const automator=require(process.env.QINGYU_AUTOMATOR_MODULE||'miniprogram-automator')
const base=process.env.QINGYU_TEST_API||'http://127.0.0.1:8787'
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base)||base==='https://resume.roomai.top','Only the project loopback or explicitly configured production API is permitted')
const tag=process.env.QINGYU_TEST_TAG||'20261029'
assert.match(tag,/^[a-z0-9-]{1,40}$/)
const output=path.resolve(__dirname,'../docs/previews/qingyu')
const artifacts=path.resolve(__dirname,'../server/data/qa-20261029')
const report={date:new Date().toISOString(),platform:'WeChat developer tools simulator',backend:process.env.QINGYU_BACKEND_TARGET||'local API',apiBaseUrl:base,steps:[],files:[],exceptions:[]}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
let mp,token
async function node(p,xpath){const e=await p.getElementByXpath(xpath);assert.ok(e,'Missing '+xpath);assert.ok(!(await e.outerWxml()).startsWith('<pages/'),'Missing '+xpath);return e}
async function frame(p){return(await node(p,"//view[contains(@class,'q-app')]" )).outerWxml()}
async function visit(route){try{await mp.reLaunch('/pages/app/'+route)}catch(e){if(!/getPageMetaByWebviewId/.test(e.message))throw e}for(let n=0;n<25;n++){const p=await mp.currentPage();if(p?.path==='pages/app/'+route.split('?')[0]){await pause(1000);return p}await pause(250)}throw Error('Route not reached: '+route)}
async function click(p,xpath){await(await node(p,xpath)).tap();await pause(600)}
async function waitText(p,value,timeout=20000){for(let n=0;n<timeout/400;n++){const text=await frame(p);if(text.includes(value))return text;const error=await p.getElementByXpath("//*[@role='alert']");if(error&&!(await error.outerWxml()).startsWith('<pages/')){const message=await error.text();if(message)throw Error(message)}await pause(400)}throw Error('Feedback not reached: '+value)}
function pass(text){report.steps.push(text);console.log('PASS',text)}
async function api(route){const r=await fetch(base+route,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200,'Authenticated '+route);return r}
async function main(){
 fs.mkdirSync(output,{recursive:true});fs.mkdirSync(artifacts,{recursive:true})
 const health=await fetch(base+'/health').then(r=>r.json())
 assert.equal(health.wechatLogin,true);assert.equal(health.developmentLogin,false)
 assert.equal((await fetch(base+'/v1/ai/service').then(r=>r.json())).enabled,false)
 mp=await automator.connect({wsEndpoint:process.env.QINGYU_WECHAT_ENDPOINT||'ws://127.0.0.1:9420'})
 mp.on('exception',e=>report.exceptions.push(e.message||e.text||String(e)))
 if(base==='https://resume.roomai.top'){
  const project=path.resolve(__dirname,'../dist/build/mp-weixin')
  const config=JSON.parse(fs.readFileSync(path.join(project,'project.config.json'),'utf8'))
  const local=JSON.parse(fs.readFileSync(path.join(project,'project.private.config.json'),'utf8'))
  assert.equal(local.setting?.urlCheck??config.setting?.urlCheck,true,'HTTPS validation must remain enabled')
  assert.ok(fs.readFileSync(path.join(project,'features/resume/backend.js'),'utf8').includes(base),'Built client must use the public HTTPS API')
  const network=await mp.callWxMethod('request',{url:base+'/health'})
  assert.equal(network.statusCode,200);assert.equal(network.data.service,'qingyu-api')
  report.domainValidation=true
  pass('Native wx.request reached the public HTTPS API with project legal-domain validation enabled')
 }
 const info=await mp.systemInfo();report.device={model:info.model,width:info.windowWidth,height:info.windowHeight,sdk:info.SDKVersion}
 assert.equal(await mp.evaluate(()=>wx.getAccountInfoSync().miniProgram.appId),'wxdccead0ec32190d0')
 pass('Correct AppID; real WeChat login enabled; development identity and AI disabled')
 let p
 if(!process.argv.includes('--resume')){
  p=await visit('testing');await click(p,"//text[text()='创建示例简历']")
  for(let n=0;n<30;n++){if((await mp.currentPage())?.path==='pages/app/workspace')break;await pause(200)}
  assert.equal((await mp.currentPage())?.path,'pages/app/workspace');await pause(1000)
  p=await visit('photo-editor?selected=5')
  await click(p,"//view[@class='q-footer-primary']//button")
  await waitText(p,'用作简历证件照')
  const photo=await node(p,"//view[@class='q-photo-stage']/image")
  const size=await mp.callWxMethod('getImageInfo',{src:await photo.attribute('src')})
  assert.equal(size.width,413);assert.equal(size.height,626)
  await click(p,"//button[@id='photo-apply']")
  pass('Created a separate fictional draft and applied a real 413x626 sample PNG; existing drafts retained')
 }
 const fictional=await mp.evaluate(()=>{const s=wx.getStorageSync('qingyu-frontend:v1');const r=s?.resumes?.find(r=>r.id===s.currentId);return Boolean(r?.sample&&r.basic?.name==='林知夏'&&r.basic?.email==='zhixia@example.com')})
 assert.ok(fictional,'Only run integration against the known fictional sample; omit --resume to create one')
 p=await visit('cloud')
 if((await frame(p)).includes('仅本机联调，不是微信身份'))await click(p,"//button[@id='cloud-logout']")
 if(!(await frame(p)).includes('id="cloud-logout"')){
  await click(p,"//*[@id='cloud-wechat-login']//button")
  await waitText(p,'微信账号已登录')
 }
 const session=await mp.evaluate(()=>wx.getStorageSync('qingyu-api-session:v1'))
 assert.equal(session?.user?.provider,'wechat');assert.ok(session.token);token=session.token
 // Keep credentials in memory only. Reports/screenshots never contain token, openid or session_key.
 pass('Native wx.login code was exchanged by the actual backend; authenticated provider is wechat')
 await click(p,"//*[@id='cloud-upload']//button")
 let content=await waitText(p,'已包含私有照片')
 const restoreId=content.match(/id="(cloud-restore-[^"]+)"/)?.[1];assert.ok(restoreId)
 const count=Number(content.match(/本机共 (\d+) 份/)?.[1]);assert.ok(count>0)
 await click(p,"//button[@id='"+restoreId+"']")
 content=await waitText(p,'已导入为新的本机简历')
 assert.ok(content.includes('本机共 '+(count+1)+' 份'))
 pass('Private photo and resume persisted; restore created a new draft without overwriting its source')
 await mp.screenshot({path:path.join(output,'user-end-cloud-'+tag+'.png')})
 if(process.argv.includes('--identity-only')){report.result='passed';report.notVerified=['Document engine still being installed; file verification runs separately'];return}
 for(const format of ['pdf','docx']){
  const before=new Set((await(await api('/v1/exports')).json()).exports.map(r=>r.id))
  p=await visit('download')
  if(format==='docx')await click(p,"//button[.//text[text()='Word']]")
  await click(p,"//*[@id='real-export-start']//button")
  await waitText(p,'文档已生成',60000)
  const rows=(await(await api('/v1/exports')).json()).exports
  const row=rows.find(r=>!before.has(r.id)&&r.format===format&&r.state==='complete');assert.ok(row)
  const data=Buffer.from(await(await api('/v1/exports/'+encodeURIComponent(row.id)+'/file')).arrayBuffer())
  assert.ok(data.length>1000);assert.equal(data.subarray(0,format==='pdf'?4:2).toString(),format==='pdf'?'%PDF':'PK')
  fs.writeFileSync(path.join(artifacts,'wechat-remote-'+tag+'.'+format),data)
  const native=await mp.callWxMethod('downloadFile',{url:base+'/v1/exports/'+encodeURIComponent(row.id)+'/file',header:{Authorization:'Bearer '+token}})
  assert.equal(native.statusCode,200);assert.ok(native.tempFilePath)
  report.files.push({format,bytes:data.length,authenticatedDownload:true,nativeDownload:true})
  pass('UI generated a real '+format.toUpperCase()+' with authenticated binary download')
  await mp.screenshot({path:path.join(output,'user-end-'+format+'-'+tag+'.png')})
 }
 p=await visit('downloads');await waitText(p,'真实文件 · 当前账号')
 assert.ok((await frame(p)).includes('已生成'))
 pass('Real file records are visible in the WeChat UI')
 p=await visit('cloud');await click(p,"//button[@id='cloud-logout']");await waitText(p,'服务端会话已失效')
 assert.equal((await fetch(base+'/v1/resumes',{headers:{Authorization:'Bearer '+token}})).status,401)
 token=undefined
 await click(p,"//*[@id='cloud-wechat-login']//button");await waitText(p,'微信账号已登录')
 assert.ok((await frame(p)).includes('私有照片 · 1'))
 pass('Logout invalidated the old session; a new real WeChat login recovered private persisted data')
 assert.deepEqual(report.exceptions,[])
 report.result='passed';report.notVerified=[base.startsWith('https:')?'Physical phone':'Physical phone and public HTTPS domain','Word/WPS rendering','Native file viewer, album permission and production payment','AI provider intentionally deferred']
 await visit('home')
}
main().catch(async e=>{report.result='failed';report.failure=e.message;console.error(e.message);process.exitCode=1;if(mp)try{await mp.screenshot({path:path.join(output,'user-end-failure-'+tag+'.png')})}catch{}}).finally(async()=>{token=undefined;fs.mkdirSync(output,{recursive:true});const name=(process.argv.includes('--identity-only')?'user-end-identity-':'user-end-e2e-')+tag+'.json';fs.writeFileSync(path.join(output,name),JSON.stringify(report,null,2)+'\n');if(mp)await mp.disconnect()})
