// Actual simulator UI -> HTTP API -> SQLite roundtrip, using a new fictional sample.
// Run only against the explicitly enabled, loopback-only development server.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const automator=require(process.env.QINGYU_AUTOMATOR_MODULE||'miniprogram-automator')
const output=path.resolve(__dirname,'../docs/previews/qingyu')
const report={date:new Date().toISOString(),platform:'WeChat developer tools simulator + local HTTP API + SQLite',steps:[],exceptions:[]}
const pause=ms=>new Promise(r=>setTimeout(r,ms))
let mp
async function node(p,xpath){const e=await p.getElementByXpath(xpath);assert.ok(e,'Missing '+xpath);assert.ok(!(await e.outerWxml()).startsWith('<pages/'),'Missing '+xpath);return e}
async function frame(p){return(await node(p,"//view[contains(@class,'q-app')]" )).outerWxml()}
async function waitPath(expected){for(let n=0;n<30;n++){let p;try{p=await mp.currentPage()}catch{}if(p?.path===expected){await pause(700);return p}await pause(250)}throw Error('Route did not reach '+expected)}
async function visit(route){try{await mp.reLaunch('/pages/app/'+route)}catch(e){if(!/getPageMetaByWebviewId/.test(e.message))throw e}const p=await waitPath('pages/app/'+route);await pause(900);return p}
async function click(p,xpath){await(await node(p,xpath)).tap();await pause(800)}
async function waitText(p,text){for(let n=0;n<20;n++){if((await frame(p)).includes(text))return;await pause(250)}throw Error('Missing feedback '+text)}
function passed(text){report.steps.push(text);console.log('PASS',text)}
async function main(){
 const health=await fetch('http://127.0.0.1:8787/health').then(r=>r.json())
 assert.equal(health.developmentLogin,true,'Start npm run server:dev first')
 for(let n=0;n<6;n++){
  try{mp=await automator.connect({wsEndpoint:process.env.QINGYU_WECHAT_ENDPOINT||'ws://127.0.0.1:9420'});break}
  catch(e){if(n===5)throw e;await pause(1000)}
 }
 mp.on('exception',e=>report.exceptions.push(e.message||e.text||String(e)))
 const system=await mp.systemInfo();report.device={model:system.model,width:system.windowWidth,height:system.windowHeight,SDKVersion:system.SDKVersion}
 await pause(1000)
 let p=await visit('testing')
 await click(p,"//text[text()='创建示例简历']");await waitPath('pages/app/workspace')
 passed('Created an independent fictional local sample through the UI; existing drafts retained')
 p=await visit('profile');await click(p,"//button[@id='open-cloud']");p=await waitPath('pages/app/cloud')
 await pause(900)
 if((await frame(p)).includes('id="cloud-logout"')){await click(p,"//button[@id='cloud-logout']");await waitText(p,'服务端会话已失效')}
 await click(p,"//*[@id='cloud-dev-login']//button");await waitText(p,'开发测试账号已连接')
 passed('Profile entry and development login made real HTTP requests')
 await click(p,"//*[@id='cloud-upload']//button");await waitText(p,'本份简历没有照片')
 const saved=await frame(p)
 assert.ok(saved.includes('当前基准版本 1'))
 const restoreId=saved.match(/id="(cloud-restore-[^"]+)"/)?.[1];assert.ok(restoreId)
 const count=Number(saved.match(/本机共 (\d+) 份/)?.[1]);assert.ok(count>0)
 passed('Saved actual text and layout to SQLite with revision 1, excluding photo paths')
 await click(p,"//button[@id='"+restoreId+"']");await waitText(p,'已导入为新的本机简历')
 assert.ok((await frame(p)).includes('本机共 '+(count+1)+' 份'))
 passed('Imported the server backup as a new local draft; the original draft remained')
 await click(p,"//*[@id='cloud-upload']//button");await waitText(p,'当前基准版本 2')
 passed('Updated the bound backup using the expected revision; new revision is 2')
 await click(p,"//button[@id='cloud-logout']");await waitText(p,'服务端会话已失效')
 await click(p,"//*[@id='cloud-dev-login']//button");await waitText(p,'开发测试账号已连接')
 assert.ok((await frame(p)).includes('版本 2'))
 passed('Logout revoked the session; login recovered the same development account and saved backup')
 await mp.screenshot({path:path.join(output,'backend-wechat.png')})
 assert.deepEqual(report.exceptions,[])
 report.result='passed'
}
main().catch(e=>{report.result='failed';report.failure=e.message;console.error(e.message);process.exitCode=1}).finally(async()=>{
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'backend-wechat.json'),JSON.stringify(report,null,2)+'\n')
 if(mp)await mp.disconnect()
})
