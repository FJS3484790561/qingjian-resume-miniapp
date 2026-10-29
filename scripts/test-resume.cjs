const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const { test, after } = require('node:test')
const ts = require('typescript')
const vm = require('node:vm')

// Exercise the actual pure data functions without importing the uni runtime.
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'qingyu-tests-'))
for (const name of ['schema', 'document', 'store', 'useUnsavedGuard']) {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/resume', name + '.ts'), 'utf8')
  fs.writeFileSync(path.join(compiled, name + '.js'), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText)
}
const { makeResume, definitions, entryHasContent, sortedEntries, validateFields, plain } = require(path.join(compiled, 'schema.js'))
const { documentBlocks, documentPages } = require(path.join(compiled, 'document.js'))
after(() => {
  for (const name of ['schema.js', 'document.js', 'store.js', 'useUnsavedGuard.js']) fs.unlinkSync(path.join(compiled, name))
  fs.rmdirSync(compiled)
})

test('blank editor content stays out of the document', () => {
  assert.equal(entryHasContent({ id: 'empty', content: '<p><br></p>' }), false)
  assert.deepEqual(documentBlocks(makeResume()), [])
})
test('new drafts do not share nested modules or layout', () => {
  const a = makeResume(true), b = makeResume(true)
  a.modules.education.entries[0].name = 'changed'
  a.layout.font = 4
  assert.notEqual(b.modules.education.entries[0].name, 'changed')
  assert.equal(b.layout.font, 2)
})
test('date ordering handles ongoing and undated entries without mutating storage', () => {
  const r = makeResume()
  r.modules.work.entries = [{ id: 'old', name: 'old', end: '2020-01' }, { id: 'now', name: 'now', end: '至今' }, { id: 'blank', name: 'blank' }]
  assert.deepEqual(sortedEntries(r, 'work').map(e => e.id), ['now', 'old', 'blank'])
  r.chronological = true
  assert.deepEqual(sortedEntries(r, 'work').map(e => e.id), ['blank', 'old', 'now'])
  assert.deepEqual(r.modules.work.entries.map(e => e.id), ['old', 'now', 'blank'])
})
test('optional fields accept empty values but reject invalid email, phone, period and length', () => {
  assert.deepEqual(validateFields({}, definitions[1].fields), {})
  const errors = validateFields({ start: '2026-01', end: '2025-12', name: '长'.repeat(61), email: 'bad', phone: 'abc' }, definitions[1].fields)
  for (const key of ['end', 'name', 'email', 'phone']) assert.ok(errors[key])
  assert.deepEqual(validateFields({ start: '2026-01', end: '至今' }, definitions[1].fields), {})
})
test('hidden modules and custom order are respected by preview', () => {
  const r = makeResume(true)
  r.modules.education.visible = false
  r.modules.skills.name = '我的能力'
  r.order = ['skills', ...r.order.filter(id => id !== 'skills')]
  const blocks = documentBlocks(r)
  assert.equal(blocks[0].section, '我的能力')
  assert.equal(blocks.some(b => b.title === '南方设计学院'), false)
})
test('all rich text survives long-content pagination including pasted text outside tags', () => {
  const r = makeResume()
  const content = '开头' + '<p>' + '长内容'.repeat(500) + '</p>末尾'
  r.modules.evaluation.entries = [{ id: 'long', content }]
  const blocks = documentPages(r).flat()
  assert.ok(documentPages(r).length > 1)
  assert.equal(blocks.map(b => plain(b.html)).join('').replace(/\s/g, ''), plain(content).replace(/\s/g, ''))
})
test('plain list values are escaped instead of becoming document markup', () => {
  const r = makeResume()
  r.modules.skills.entries = [{ id: 'tags', item1: '<script>alert(1)</script>' }]
  const html = documentBlocks(r)[0].html
  assert.ok(html.includes('&lt;script&gt;'))
  assert.equal(html.includes('<script>'), false)
})

test('preview preserves long content at every font and spacing level', () => {
  const r = makeResume()
  const content = Array.from({ length: 35 }, (_, i) => `<p>第 ${i + 1} 项：${'完整保留经历内容。'.repeat(12)}</p>`).join('')
  r.modules.project.entries = [{ id: 'phase2-long', name: '长内容验收', content }]
  for (let level = 0; level < 5; level++) {
    Object.assign(r.layout, { font: level, line: level, gap: level })
    const pages = documentPages(r)
    assert.ok(pages.length > 1)
    assert.equal(pages.flat().map(b => plain(b.html)).join('').replace(/\s/g, ''), plain(content).replace(/\s/g, ''))
    assert.equal(new Set(pages.flat().map(b => b.key)).size, pages.flat().length)
  }
})

test('module management saves atomically and hidden content can be restored', () => {
  const s = loadStore()
  const before = snapshot(s.state)
  const apply = r => {
    r.order = ['skills', ...r.order.filter(id => id !== 'skills')]
    r.modules.skills.name = '核心能力'
    r.modules.education.visible = false
  }
  s.failWrites(true)
  assert.equal(s.updateResume(apply), false)
  assert.equal(snapshot(s.state), before)
  s.failWrites(false)
  assert.equal(s.updateResume(apply), true)
  const restored = loadStore(s.disk())
  assert.equal(documentBlocks(restored.currentResume.value)[0].section, '核心能力')
  assert.equal(documentBlocks(restored.currentResume.value).some(b => b.title === '南方设计学院'), false)
  assert.ok(restored.currentResume.value.modules.education.entries.length)
  restored.updateResume(r => { r.modules.education.visible = true })
  assert.ok(documentBlocks(restored.currentResume.value).some(b => b.title === '南方设计学院'))
})

test('preview layout and chronological changes persist only to the current draft', () => {
  const s = loadStore()
  const first = s.currentResume.value.id
  const original = JSON.parse(snapshot(s.currentResume.value))
  const second = s.createResume(true).id
  const change = r => { r.chronological = true; r.title = '第二阶段测试'; Object.assign(r.layout, { templateId: 'clean', color: '#326CA8', cover: 'quiet', font: 4, line: 0, gap: 3 }) }
  s.failWrites(true)
  const before = snapshot(s.currentResume.value)
  assert.equal(s.updateResume(change), false)
  assert.equal(snapshot(s.currentResume.value), before)
  s.failWrites(false)
  assert.equal(s.updateResume(change), true)
  const restored = loadStore(s.disk())
  assert.equal(restored.currentResume.value.title, '第二阶段测试')
  assert.equal(restored.currentResume.value.layout.font, 4)
  assert.equal(restored.currentResume.value.layout.line, 0)
  assert.equal(restored.currentResume.value.chronological, true)
  assert.equal(restored.activateResume(first), true)
  assert.equal(snapshot(restored.currentResume.value), snapshot(original))
  assert.equal(restored.activateResume(second), true)
  assert.equal(restored.currentResume.value.layout.cover, 'quiet')
})

// Run the actual store with Vue reactivity and a controlled uni storage adapter.
// Faults are injected in memory; no browser or WeChat draft storage is touched.
function loadStore(saved) {
  const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
  let disk = copy(saved), writeError = false, readError = false, writes = 0
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(path.join(compiled, 'store.js'), 'utf8'), {
    module, exports: module.exports,
    require: name => name === './schema' ? require(path.join(compiled, 'schema.js')) : require(name),
    uni: {
      getStorageSync: () => { if (readError) throw new Error('read failed'); return copy(disk) },
      setStorageSync: (_key, value) => { if (writeError) throw new Error('storage full'); disk = copy(value); writes++ },
      showToast: () => {}
    }
  })
  return { ...module.exports, disk: () => copy(disk), writes: () => writes,
    failWrites: value => { writeError = value }, failReads: value => { readError = value },
    seed: value => { disk = copy(value) } }
}
const snapshot = value => JSON.stringify(value)

test('native unsaved guard follows dirty state and suspends while the page is hidden', () => {
  const vue = require('vue')
  const hooks = {}, calls = []
  const module = { exports: {} }
  const scope = vue.effectScope()
  vm.runInNewContext(fs.readFileSync(path.join(compiled, 'useUnsavedGuard.js'), 'utf8'), {
    module, exports: module.exports,
    require: name => name === 'vue' ? vue : {
      onShow: fn => { hooks.show = fn }, onHide: fn => { hooks.hide = fn }, onUnload: fn => { hooks.unload = fn }
    },
    uni: { enableAlertBeforeUnload: options => calls.push(['enable', options.message]), disableAlertBeforeUnload: () => calls.push(['disable']) }
  })
  try {
    const dirty = vue.ref(false)
    const guard = scope.run(() => module.exports.useUnsavedGuard(() => dirty.value, '未保存提醒'))
    hooks.show()
    dirty.value = true
    assert.deepEqual(calls.at(-1), ['enable', '未保存提醒'])
    hooks.hide()
    assert.deepEqual(calls.at(-1), ['disable'])
    dirty.value = false; dirty.value = true
    assert.deepEqual(calls.at(-1), ['disable'])
    hooks.show()
    assert.deepEqual(calls.at(-1), ['enable', '未保存提醒'])
    guard.clear()
    assert.deepEqual(calls.at(-1), ['disable'])
    hooks.unload()
    assert.deepEqual(calls.at(-1), ['disable'])
  } finally { scope.stop() }
})

test('draft create, switch and edits survive reload without leaking between drafts', () => {
  const s = loadStore()
  const first = s.currentResume.value.id
  const added = s.createResume(false)
  assert.ok(added)
  assert.equal(s.currentResume.value.id, added.id)
  assert.equal(s.updateResume(r => { r.basic.name = '测试用户'; r.basic.email = 'demo@example.com' }), true)
  assert.equal(s.activateResume(first), true)
  assert.equal(s.currentResume.value.basic.name, '林知夏')
  const restored = loadStore(s.disk())
  assert.equal(restored.currentResume.value.id, first)
  assert.equal(restored.activateResume(added.id), true)
  assert.equal(restored.currentResume.value.basic.name, '测试用户')
})
test('failed create, switch, delete, reset and edit leave memory and disk unchanged', () => {
  const s = loadStore()
  const original = s.currentResume.value.id
  assert.ok(s.createResume())
  const before = snapshot(s.state), disk = snapshot(s.disk())
  s.failWrites(true)
  assert.equal(s.createResume(), null)
  assert.equal(s.activateResume(original), false)
  assert.equal(s.removeResume(original), false)
  assert.equal(s.resetLocal(), false)
  assert.equal(s.updateResume(r => { r.basic.name = '不能写入' }), false)
  assert.equal(snapshot(s.state), before)
  assert.equal(snapshot(s.disk()), disk)
  s.failWrites(false)
  assert.equal(s.updateResume(r => { r.basic.name = '重试成功' }), true)
  assert.equal(loadStore(s.disk()).currentResume.value.basic.name, '重试成功')
})
test('deleting another draft preserves selection; deleting the last creates an empty draft', () => {
  const s = loadStore()
  const original = s.currentResume.value.id
  const second = s.createResume().id
  const third = s.createResume().id
  assert.equal(s.activateResume(second), true)
  assert.equal(s.removeResume(third), true)
  assert.equal(s.currentResume.value.id, second)
  assert.equal(s.removeResume(second), true)
  assert.equal(s.currentResume.value.id, original)
  assert.equal(s.removeResume(original), true)
  assert.equal(s.state.resumes.length, 1)
  assert.equal(Object.keys(s.currentResume.value.basic).length, 0)
  assert.equal(s.currentResume.value.sample, false)
  const before = snapshot(s.state)
  assert.equal(s.activateResume('missing'), false)
  assert.equal(s.removeResume('missing'), false)
  assert.equal(snapshot(s.state), before)
})
test('prepared long draft is persisted in one write with all content', () => {
  const s = loadStore()
  const created = s.createResume(true, r => { r.title = '长内容'; r.modules.project.entries[0].content = '<p>最后一项</p>' })
  assert.ok(created)
  assert.equal(s.writes(), 1)
  const restored = loadStore(s.disk())
  assert.equal(restored.currentResume.value.title, '长内容')
  assert.equal(restored.currentResume.value.modules.project.entries[0].content, '<p>最后一项</p>')
})
test('malformed persisted data is blocked and never replaced by a sample', () => {
  const valid = loadStore()
  valid.createResume()
  const corruptions = [
    v => { v.resumes[0].order = ['work', 'work'] },
    v => { v.resumes[0].basic.name = null },
    v => { v.resumes[0].modules.work.entries = [null] },
    v => { v.resumes[0].layout.font = 99 },
    v => { v.resumes[0].layout = null },
    v => { v.member = 999 },
    v => { v.exports = [null] },
    v => { v.resumes.push(v.resumes[0]) }
  ]
  for (const corrupt of corruptions) {
    const data = valid.disk(); corrupt(data)
    const s = loadStore(data)
    assert.equal(s.storageStatus.blocked, true)
    assert.equal(s.createResume(), null)
    assert.equal(s.updateResume(r => { r.title = '不应覆盖' }), false)
    assert.equal(s.writes(), 0)
    assert.equal(snapshot(s.disk()), snapshot(data))
  }
})
test('recovery retries valid data and only explicit reset may replace unreadable data', () => {
  const s = loadStore({ version: 99, original: 'keep' })
  assert.equal(s.storageStatus.blocked, true)
  assert.equal(s.reloadLocal(), false)
  const clean = loadStore(); clean.createResume()
  s.seed(clean.disk())
  s.failReads(true)
  assert.equal(s.reloadLocal(), false)
  assert.equal(s.writes(), 0)
  s.failReads(false)
  assert.equal(s.reloadLocal(), true)
  assert.equal(s.storageStatus.blocked, false)
  assert.equal(s.currentResume.value.id, clean.currentResume.value.id)
  const broken = loadStore({ version: 99 })
  broken.failWrites(true)
  assert.equal(broken.resetLocal(), false)
  assert.equal(broken.storageStatus.blocked, true)
  broken.failWrites(false)
  assert.equal(broken.resetLocal(), true)
  assert.equal(broken.storageStatus.blocked, false)
})
