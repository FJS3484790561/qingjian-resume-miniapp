// Optional integration runner. Uses the official miniprogram-automator SDK via
// QINGYU_AUTOMATOR_MODULE; connect to an already-open, authorized local project.
// No API mocks, app-state injection, user-storage resets, uploads or payments.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const automator = require(process.env.QINGYU_AUTOMATOR_MODULE || 'miniprogram-automator')
const output = path.resolve(__dirname, '../docs/previews/qingyu')
const auxiliaryOnly=process.argv.includes('--auxiliary-only')
const coreOnly=process.argv.includes('--core-only')
const report = { date:'2026-10-24', platform:'WeChat developer tools simulator', routes:[], layouts:[], interactions:[], exceptions:[] }
let mp
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms))
async function visit(route) {
  console.log('OPEN',route)
  try { await mp.reLaunch('/pages/app/'+route) } catch(e) { if(!/getPageMetaByWebviewId/.test(e.message))throw e }
  await pause(900)
  const p=await waitPath('pages/app/'+route.split('?')[0])
  await pause(1200)
  return p
}
async function element(p, xpath) {
  const node=await p.getElementByXpath(xpath)
  assert.ok(node,'Missing '+xpath)
  // Devtools may return the page root for a missing XPath. Never treat it as a match.
  assert.ok(!(await node.outerWxml()).startsWith('<pages/'),'Missing '+xpath)
  return node
}
async function tapText(p, text) {
  let node=await p.getElementByXpath(`//button[text()='${text}']`)
  if(!node||(await node.outerWxml()).startsWith('<pages/'))node=await element(p,`//text[text()='${text}']`)
  await node.tap()
  await pause(400)
}
async function tapAction(p,text,sheet=false){
  console.log('ACTION',text)
  const button=await element(p,sheet?"//view[@class='q-sheet']//button[contains(@class,'wd-button')]":"//view[@class='q-footer-primary']//button")
  assert.ok((await button.outerWxml()).includes(text),'Unexpected primary action '+text)
  await button.tap();await pause(450)
}
async function waitPath(expected) {
  for(let i=0;i<30;i++) {
    let p
    try{p=await mp.currentPage()}catch(e){if(!/getPageMetaByWebviewId/.test(e.message))throw e}
    if(p?.path===expected){await pause(600);return p}
    await pause(150)
  }
  throw Error('Route did not reach '+expected)
}
async function shot(name) { await mp.screenshot({path:path.join(output,name+'.png')}) }
async function assertText(p, text) {
  const frame=await element(p,"//view[contains(@class,'q-app')]")
  assert.ok((await frame.outerWxml()).includes(text),'Missing rendered feedback: '+text)
}
async function scenario(value) {
  const p=await visit('testing')
  await tapText(p,value)
}
async function main() {
  fs.mkdirSync(output,{recursive:true})
  for(let attempt=0;attempt<6;attempt++){
    try{mp=await automator.connect({wsEndpoint:process.env.QINGYU_WECHAT_ENDPOINT||'ws://127.0.0.1:9420'});break}
    catch(e){if(attempt===5)throw e;await pause(1000)}
  }
  await pause(500)
  mp.on('exception',e=>report.exceptions.push(e.message||e.text||String(e)))
  const system=await mp.systemInfo()
  report.device={model:system.model,windowWidth:system.windowWidth,windowHeight:system.windowHeight,SDKVersion:system.SDKVersion}
  let p
  if(!auxiliaryOnly){
  p=await visit('testing')
  await tapText(p,'正常完成')
  await tapText(p,'创建示例简历')
  p=await waitPath('pages/app/workspace')
  await shot('wechat-workspace')
  report.interactions.push('Created a separate fictional sample draft through the test-page button')
  console.log('PASS sample draft')

  await (await element(p,"//button[@aria-label='编辑个人基本信息']")).tap()
  p=await waitPath('pages/app/module');await p.waitFor(1200)
  const nameInput=await element(p,"//input[@id='f-name']")
  const emailInput=await element(p,"//input[@id='f-email']")
  await nameInput.input('微信前端验收样例')
  await emailInput.input('invalid-email');await p.waitFor(250)
  await tapAction(p,'保存信息')
  assert.equal((await mp.currentPage()).path,'pages/app/module')
  const validation=await element(p,"//view[@class='q-error-summary']")
  assert.ok((await validation.outerWxml()).includes('邮箱'),'Missing field validation summary')
  assert.equal(await emailInput.value(),'invalid-email')
  await emailInput.input('qa@example.com');await p.waitFor(250)
  await tapAction(p,'保存信息')
  p=await waitPath('pages/app/workspace');await p.waitFor(500)
  await assertText(p,'微信前端验收样例')
  await (await element(p,"//button[@aria-label='编辑个人基本信息']")).tap()
  p=await waitPath('pages/app/module');await p.waitFor(900)
  assert.equal(await (await element(p,"//input[@id='f-name']")).value(),'微信前端验收样例')
  assert.equal(await (await element(p,"//input[@id='f-email']")).value(),'qa@example.com')
  report.interactions.push('Native form invalid-email feedback retained input; corrected save and route re-entry restored the saved sample')
  console.log('PASS form validation/save/re-entry')

  const routes=['home','profile','workspace','module?module=basic','entries?module=work','manage','preview','templates','photos','photo-editor?selected=5','word','word-detail?selected=clean','membership','help','settings','article?kind=privacy','ai','download','downloads','testing','drafts']
  for(const route of routes){
    p=await visit(route)
    const content=await element(p,"//view[contains(@class,'q-app')]")
    assert.ok(content,'App frame missing on '+route)
    const size=await content.size()
    assert.ok(Number(size.height)>0,'Empty app frame '+route)
    report.routes.push({route,status:'rendered',width:Number(size.width),height:Number(size.height)})
    if(['workspace','module?module=basic','preview','templates','photo-editor?selected=5','word-detail?selected=clean','membership','drafts','ai','manage','entries?module=work'].includes(route)){
      const row=await element(p,"//view[@class='q-footer-row']")
      const primary=await element(p,"//view[@class='q-footer-primary']")
      const rowSize=await row.size(),buttonSize=await primary.size(),offset=await primary.offset()
      assert.ok(Number(rowSize.height)<=60,'Footer wrapped on '+route)
      assert.ok(Number(buttonSize.width)>=90,'Primary action collapsed on '+route)
      assert.ok(Number(offset.top)+Number(buttonSize.height)<=Number(system.windowHeight),'Primary action outside screen on '+route)
      report.layouts.push({route,rowHeight:Number(rowSize.height),primaryWidth:Number(buttonSize.width)})
    }
    if(['module?module=basic','preview','membership','ai','downloads'].includes(route))await shot('wechat-'+route.split('?')[0])
    console.log('PASS route',route)
  }

  p=await visit('photo-editor?selected=5')
  const stage=await element(p,"//view[@class='q-photo-stage']")
  assert.ok(Number((await stage.size()).height)>200,'Photo preview collapsed')
  await tapAction(p,'生成本机预览')
  await p.waitFor(800)
  const generated=await element(p,"//view[@class='q-photo-stage']/image")
  const info=await mp.callWxMethod('getImageInfo',{src:await generated.attribute('src')})
  assert.equal(info.width,413);assert.equal(info.height,626)
  const apply=await element(p,"//button[@id='photo-apply']")
  await apply.tap();await p.waitFor(500)
  assert.equal(String(await apply.attribute('disabled')),'true')
  report.photoPixels={width:info.width,height:info.height}
  await shot('wechat-photo')
  report.interactions.push('Generated a 413x626 PNG from the built-in fictional portrait and applied it to the sample draft')
  console.log('PASS photo generate/apply')

  p=await visit('ai')
  await tapAction(p,'体验整理效果');await p.waitFor(750)
  const textarea=await element(p,"//textarea[contains(@class,'q-ai-result')]")
  await textarea.input('• 微信模拟器中的虚构验收内容。')
  const applyAI=await element(p,"//button[@id='ai-apply']");await applyAI.tap();await p.waitFor(250)
  const undo=await element(p,"//button[@id='ai-undo']");await undo.tap();await p.waitFor(250)
  await assertText(p,'已恢复原文')
  await shot('wechat-ai')
  report.interactions.push('Edited, applied and undid a local AI-formatting demo; no AI service')
  console.log('PASS AI apply/undo')

  p=await visit('download')
  await tapText(p,'进入原有模拟流程（不生成文件）')
  await tapAction(p,'开始模拟下载');await p.waitFor(850)
  await assertText(p,'已记录一次模拟完成')
  await shot('wechat-download')
  report.interactions.push('Completed local download simulation; no document file generated')
  console.log('PASS download simulation')
  }
  if(!coreOnly){

  await scenario('服务错误')
  p=await visit('download?type=word&selected=clear')
  await tapText(p,'进入原有模拟流程（不生成文件）')
  await tapAction(p,'开始模拟下载');await p.waitFor(850)
  await assertText(p,'模拟服务错误')
  await tapText(p,'查看模板')
  await waitPath('pages/app/word-detail')
  await pause(1200)
  report.interactions.push('Word download error preserved the template-specific return path')
  console.log('PASS Word error return')

  p=await visit('membership')
  await tapAction(p,'模拟开通会员')
  await assertText(p,'请先勾选说明')
  await (await element(p,"//button[@class='q-agreement']")).tap()
  await p.waitFor(400)
  await tapAction(p,'模拟开通会员')
  await tapAction(p,'确认模拟开通',true);await p.waitFor(750)
  await assertText(p,'模拟开通未完成')
  await (await element(p,"//button[@aria-label='关闭模拟开通']")).tap()
  await p.waitFor(400)
  await assertText(p,'已取消模拟开通')
  report.interactions.push('Membership acknowledgement, service error and cancellation; no payment')
  console.log('PASS membership error/cancel')

  await scenario('下载额度用完')
  p=await mp.currentPage()
  const reset=await element(p,"//button[text()='重置模拟会员（保留简历）']")
  if(String(await reset.attribute('disabled'))!=='true')await reset.tap()
  await p.waitFor(300)
  p=await visit('download')
  await tapText(p,'进入原有模拟流程（不生成文件）')
  await tapAction(p,'开始模拟下载');await assertText(p,'今日试用机会已用完')
  await tapText(p,'了解更多');await assertText(p,'模拟距下次免费还有')
  await shot('wechat-quota')
  report.interactions.push('Quota explanation and local countdown reached after reset of simulated membership, without deleting drafts')
  console.log('PASS quota')

  await scenario('正常完成')
  p=await visit('membership')
  await (await element(p,"//scroll-view[@class='q-scroll']")).scrollTo(0,1100)
  await p.waitFor(250)
  await (await element(p,"//button[@class='q-agreement']")).tap()
  await p.waitFor(400)
  await tapAction(p,'模拟开通会员');await tapAction(p,'确认模拟开通',true);await p.waitFor(750)
  await assertText(p,'模拟开通完成')
  await (await element(p,"//button[@aria-label='关闭模拟开通']")).tap()
  await p.waitFor(400)
  report.interactions.push('Membership local success; no payment or order')
  console.log('PASS membership success')

  p=await visit('testing')
  await (await element(p,"//button[text()='重置模拟会员（保留简历）']")).tap()
  await p.waitFor(300)
  await assertText(p,'模拟会员已重置')
  }
  await visit('workspace')
  await shot('wechat-workspace')
  assert.equal(report.exceptions.length,0,'Runtime exceptions were emitted')
}
main().catch(e=>{report.failure=e.message;process.exitCode=1;console.error('FAIL',e.message)}).finally(async()=>{
  if(mp)await mp.disconnect()
  fs.writeFileSync(path.join(output,auxiliaryOnly?'wechat-auxiliary.json':'wechat-smoke.json'),JSON.stringify(report,null,2)+'\n')
})
