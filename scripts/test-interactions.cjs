const { test } = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./resume-test-harness.cjs')
const snapshot = value => JSON.stringify(value)

test('all photo specifications and hostile route values resolve safely', () => {
  const h = harness('PhotoPages', { mode: 'photo-editor' })
  try {
    const { photoSpec, photoPlacement } = h.load('photo')
    const sizes = [[295,413],[413,579],[260,378],[390,567],[413,531],[413,626]]
    sizes.forEach(([width,height], i) => assert.deepEqual([photoSpec(String(i)).width,photoSpec(String(i)).height],[width,height]))
    for (const value of ['-1','99','1.5','NaN','Infinity','foo']) assert.equal(photoSpec(value).width,295)
    const crop = photoPlacement(1000,500,295,413,100,0,0)
    assert.equal(crop.height,413); assert.equal(crop.width,826)
    assert.equal(crop.x,(295-826)/2)
    assert.throws(()=>photoPlacement(0,500,295,413,100,0,0))
  } finally { h.dispose() }
})

function canvas(options = {}) {
  const draw = new Proxy({}, { get: (_target, key) => key === 'draw' ? (_reserve, done) => done() : () => {} })
  return { createCanvasContext: () => draw, canvasToTempFilePath: o => { o.success({ tempFilePath: '/tmp/photo.png' }) }, ...options }
}

test('photo generation locks repeats, exports selected pixels and ignores stale callbacks', () => {
  let exportOptions
  const h = harness('PhotoPages', { mode: 'photo-editor', selected: '5' }, canvas({ canvasToTempFilePath: o => { exportOptions = o } }))
  try {
    const p = h.screen
    p.generate(); p.generate()
    assert.equal(p.busy.value,true)
    assert.equal(exportOptions.destWidth,413); assert.equal(exportOptions.destHeight,626)
    h.fire('hide'); exportOptions.success({tempFilePath:'/stale.png'})
    assert.equal(p.generated.value,''); assert.equal(p.busy.value,false)
    h.fire('show'); p.generate(); exportOptions.success({tempFilePath:'/latest.png'})
    assert.equal(p.generated.value,'/latest.png')
    p.color('#5389bc'); assert.equal(p.generated.value,'')
  } finally { h.dispose() }
})

test('photo generation timeout unlocks retry and late export cannot win', () => {
  let pending
  const h = harness('PhotoPages', { mode:'photo-editor' }, canvas({canvasToTempFilePath:o=>{pending=o}}))
  try {
    h.screen.generate(); h.advance(15000)
    assert.equal(h.screen.busy.value,false); assert.ok(h.screen.error.value)
    pending.success({tempFilePath:'/too-late.png'})
    assert.equal(h.screen.generated.value,'')
  } finally { h.dispose() }
})

test('cancelled photo selection preserves crop; rejected permission has persistent feedback', () => {
  let pending
  const h = harness('PhotoPages', { mode:'photo-editor' }, { chooseImage: o=>{pending=o} })
  try {
    const p=h.screen; p.image.value='/existing.png'; p.scale.value=140
    p.choose(); p.choose(); pending.fail({errMsg:'chooseImage:fail cancel'}); pending.complete()
    assert.equal(p.image.value,'/existing.png'); assert.equal(p.scale.value,140); assert.match(p.feedback.value,/取消/)
    p.choose(); pending.fail({errMsg:'chooseImage:fail auth deny'}); pending.complete()
    assert.match(p.error.value,/权限/); assert.equal(p.choosing.value,false)
  } finally { h.dispose() }
})

test('photo apply cannot change a different draft; saved path is reused after failed storage', () => {
  let pending, saves=0
  const h = harness('PhotoPages', {mode:'photo-editor'}, {saveFile:o=>{pending=o;saves++}})
  try {
    const p=h.screen; p.generated.value='/tmp/generated.png'; p.useForResume(); p.useForResume()
    assert.equal(saves,1)
    h.store.createResume(); pending.success({savedFilePath:'/saved/a.png'})
    assert.equal(h.store.currentResume.value.basic.photo,undefined); assert.match(p.error.value,/草稿/)
    p.useForResume(); h.failWrites(true); pending.success({savedFilePath:'/saved/a.png'})
    assert.equal(h.store.currentResume.value.basic.photo,undefined); assert.match(p.error.value,/保存失败/)
    h.failWrites(false); p.useForResume()
    assert.equal(saves,2); assert.equal(h.store.currentResume.value.basic.photo,'/saved/a.png')
  } finally { h.dispose() }
})

test('album rejection keeps generated picture available for retry', () => {
  const h=harness('PhotoPages',{mode:'photo-editor'},{saveImageToPhotosAlbum:o=>{o.fail({errMsg:'saveImageToPhotosAlbum:fail auth deny'});o.complete()}})
  try {
    h.screen.generated.value='/photo.png';h.screen.album()
    assert.equal(h.screen.generated.value,'/photo.png');assert.equal(h.screen.saving.value,false);assert.match(h.screen.error.value,/权限/)
  } finally { h.dispose() }
})

test('download cancellation, hiding and duplicate clicks never add extra records', () => {
  const h = harness('DownloadPage')
  try {
    const p=h.screen;p.start();p.start();h.advance(280);p.cancel();h.advance(1000)
    assert.equal(h.store.state.exports.length,0)
    p.start();h.fire('hide');h.advance(1000);assert.equal(h.store.state.exports.length,0)
    h.fire('show');p.start();h.advance(700);assert.equal(h.store.state.exports.length,1)
    p.start();h.advance(700);assert.equal(h.store.state.exports.length,1)
    assert.equal(p.stage.value,'success')
  } finally { h.dispose() }
})

test('download failures and quota do not write; retry writes captured title once', () => {
  const h=harness('DownloadPage')
  try {
    const p=h.screen;h.store.state.simulation='quota';p.start();assert.equal(p.stage.value,'quota');assert.equal(h.writes(),0)
    h.store.state.simulation='error';p.start();h.advance(700);assert.equal(p.stage.value,'error');assert.equal(h.writes(),0)
    h.store.state.simulation='success';h.failWrites(true);p.start();h.advance(700);assert.equal(p.stage.value,'error');assert.equal(h.store.state.exports.length,0);assert.match(p.error.value,/本机/)
    h.failWrites(false);const title=h.store.currentResume.value.title;p.start();h.store.currentResume.value.title='later';h.advance(700)
    assert.equal(h.store.state.exports[0].title,title);assert.equal(h.store.state.exports.length,1)
  } finally { h.dispose() }
})

test('membership requires acknowledgement, cancels pending work and snapshots the selected plan', () => {
  const h=harness('LibraryPages',{mode:'membership'})
  try {
    const p=h.screen;p.order();assert.equal(p.checkout.value,false);assert.ok(p.operationError.value)
    p.agreeing.value=true;p.plan.value=2;p.order();p.simulatePay();p.simulatePay();p.cancelCheckout();h.advance(1000);assert.equal(h.store.state.member,null)
    p.order();p.simulatePay();p.plan.value=3;h.advance(600);assert.equal(h.store.state.member,2);assert.equal(h.writes(),1)
    p.simulatePay();h.advance(600);assert.equal(h.writes(),1)
  } finally { h.dispose() }
})

test('membership error, persistence failure and hiding preserve prior simulated rights', () => {
  const h=harness('LibraryPages',{mode:'membership'})
  try {
    const p=h.screen;h.store.state.member=1;p.agreeing.value=true;p.order();h.store.state.simulation='error';p.simulatePay();h.advance(600);assert.equal(p.result.value,'error');assert.equal(h.store.state.member,1)
    h.store.state.simulation='success';h.failWrites(true);p.simulatePay();h.advance(600);assert.equal(h.store.state.member,1);assert.match(p.operationError.value,/本机/)
    h.failWrites(false);p.simulatePay();h.fire('hide');h.advance(600);assert.equal(h.store.state.member,1);assert.equal(p.checkout.value,false)
  } finally { h.dispose() }
})

test('AI applies editable output and undo restores the exact original; failed storage retains result', () => {
  const h=harness('AiPage');h.screen.mode.value='demo'
  try {
    const p=h.screen;const target=p.target.value;const original=target.content
    p.generate();h.advance(650);p.result.value='手动修改的结果。';h.failWrites(true);p.apply()
    assert.equal(p.applied.value,false);assert.equal(p.target.value.content,original);assert.match(p.error.value,/本机/)
    h.failWrites(false);p.apply();assert.equal(p.applied.value,true);assert.notEqual(p.target.value.content,original)
    p.undo();assert.equal(p.target.value.content,original);assert.equal(p.result.value,'')
  } finally { h.dispose() }
})

test('AI rejects blank result and stale draft or entry without overwriting later edits', () => {
  const h=harness('AiPage');h.screen.mode.value='demo'
  try {
    const p=h.screen;p.generate();h.advance(650);p.result.value='  ';p.apply();assert.equal(p.applied.value,false)
    p.result.value='有效结果';h.store.createResume(true);const before=snapshot(h.store.currentResume.value);p.apply();assert.equal(snapshot(h.store.currentResume.value),before);assert.match(p.error.value,/草稿/)
    p.generate();h.advance(650);const t=p.target.value;h.store.updateResume(r=>{r.modules[t.module].entries.find(e=>e.id===t.id).content='<p>后来编辑的内容</p>'});p.apply();assert.equal(p.applied.value,false);assert.match(p.error.value,/修改/)
  } finally { h.dispose() }
})

test('AI hides cancel pending generation and unsaved result return can continue or discard', async () => {
  const h=harness('AiPage');h.screen.mode.value='demo'
  try {
    const p=h.screen;p.generate();h.fire('hide');h.advance(650);assert.equal(p.result.value,'');assert.equal(p.busy.value,false)
    h.fire('show');p.generate();h.advance(650);const result=p.result.value
    const first=p.beforeBack();h.modals.at(-1).success({confirm:false});h.modals.at(-1).complete();assert.equal(await first,false);assert.equal(p.result.value,result)
    const second=p.beforeBack();h.modals.at(-1).success({confirm:true});h.modals.at(-1).complete();assert.equal(await second,true)
  } finally { h.dispose() }
})

test('AI replacing a manually edited result requires confirmation and cancel preserves edits', async () => {
  const h=harness('AiPage');h.screen.mode.value='demo'
  try {
    const p=h.screen;p.generate();h.advance(650);p.result.value='我手动调整后的结果'
    const cancel=p.requestGenerate();h.modals.at(-1).success({confirm:false});h.modals.at(-1).complete();await cancel
    assert.equal(p.result.value,'我手动调整后的结果');assert.equal(p.busy.value,false)
    const repeat=p.requestGenerate();h.modals.at(-1).success({confirm:true});h.modals.at(-1).complete();await repeat
    assert.equal(p.busy.value,true);h.advance(650);assert.notEqual(p.result.value,'我手动调整后的结果')
    const prior=p.target.value.id;const change=p.changeTarget({detail:{value:1}})
    h.modals.at(-1).success({confirm:false});h.modals.at(-1).complete();await change
    assert.equal(p.target.value.id,prior);assert.ok(p.result.value)
  } finally { h.dispose() }
})

test('simulation member reset preserves drafts and records and failed settings retain state', () => {
  const h=harness('AccountPages',{mode:'testing'})
  try {
    h.store.state.member=3;const drafts=snapshot(h.store.state.resumes);h.screen.resetMember()
    assert.equal(h.store.state.member,null);assert.equal(snapshot(h.store.state.resumes),drafts)
    h.failWrites(true);h.screen.motion({detail:{value:true}});assert.equal(h.store.state.reduced,false);assert.ok(h.screen.operationError.value)
    h.screen.simulation('error');assert.equal(h.store.state.simulation,'success')
  } finally { h.dispose() }
})

test('draft creation and selection ignore repeat taps until the page is shown again', () => {
  const h=harness('AccountPages',{mode:'testing'})
  try {
    const original=h.store.state.resumes.length
    h.screen.add(true);h.screen.add(true)
    assert.equal(h.store.state.resumes.length,original+1)
    h.fire('show');h.screen.add(false)
    assert.equal(h.store.state.resumes.length,original+2)
  } finally { h.dispose() }
})

test('basic-photo selection is locked and a late saved-file callback cannot change an unloaded form', () => {
  let choose,save
  const h=harness('ModuleForm',{moduleId:'basic'},{chooseImage:o=>{choose=o},saveFile:o=>{save=o}})
  try {
    const p=h.screen;const original=p.buffer.value.photo
    p.choosePhoto();assert.equal(p.photoBusy.value,true)
    choose.success({tempFilePaths:['/tmp/basic.png']})
    assert.equal(p.photoBusy.value,true)
    h.fire('unmount');save.success({savedFilePath:'/saved/basic.png'})
    assert.equal(p.buffer.value.photo,original)
  } finally { h.dispose() }
})

test('basic-photo cancellation preserves original image and unlocks form submission', () => {
  let choose
  const h=harness('ModuleForm',{moduleId:'basic'},{chooseImage:o=>{choose=o}})
  try {
    const p=h.screen;p.buffer.value.photo='/previous.png';p.choosePhoto()
    choose.fail({errMsg:'chooseImage:fail cancel'})
    assert.equal(p.buffer.value.photo,'/previous.png');assert.equal(p.photoBusy.value,false);assert.match(p.photoFeedback.value,/取消/)
  } finally { h.dispose() }
})

test('navigation locks concurrent transitions and failure releases retry', () => {
  let pending,opens=0
  const h=harness('PhotoPages',{mode:'photos'},{navigateTo:o=>{pending=o;opens++}})
  try {
    const nav=h.load('navigation')
    assert.equal(nav.go('module',{module:'自定义 & test'}),true)
    assert.equal(nav.go('module'),false);assert.equal(opens,1)
    assert.ok(pending.url.includes(encodeURIComponent('自定义 & test')))
    pending.fail();assert.equal(nav.go('photos'),true);assert.equal(opens,2)
    pending.complete()
  } finally { h.dispose() }
})
