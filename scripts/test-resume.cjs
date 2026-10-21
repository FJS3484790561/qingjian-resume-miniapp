const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const { test, after } = require('node:test')
const ts = require('typescript')

// Exercise the actual pure data functions without importing the uni runtime.
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'qingyu-tests-'))
for (const name of ['schema', 'document']) {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/resume', name + '.ts'), 'utf8')
  fs.writeFileSync(path.join(compiled, name + '.js'), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText)
}
const { makeResume, definitions, entryHasContent, sortedEntries, validateFields, plain } = require(path.join(compiled, 'schema.js'))
const { documentBlocks, documentPages } = require(path.join(compiled, 'document.js'))
after(() => {
  for (const name of ['schema.js', 'document.js']) fs.unlinkSync(path.join(compiled, name))
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
