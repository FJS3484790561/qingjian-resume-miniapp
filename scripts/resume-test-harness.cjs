// Execute actual Vue SFC setup code with deterministic clocks and isolated uni APIs.
// These tests exercise cancellation/races; they do not claim native UI validation.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { parse, compileScript } = require('@vue/compiler-sfc')
const vue = require('vue')
const root = path.resolve(__dirname, '../src')

function harness(name, props = {}, overrides = {}, platform = 'MP-WEIXIN') {
  let disk, writeError = false, now = 0, sequence = 0, writes = 0
  const timers = new Map(), cache = new Map(), hooks = {}, modals = [], toasts = []
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
  const register = key => fn => (hooks[key] ||= []).push(fn)
  const finish = options => { options.success?.({}); options.complete?.({}) }
  const uni = {
    getStorageSync: () => clone(disk),
    setStorageSync: (_key, value) => { if (writeError) throw Error('full'); disk = clone(value); writes++ },
    showToast: options => toasts.push(options.title),
    showModal: options => modals.push(options),
    enableAlertBeforeUnload() {}, disableAlertBeforeUnload() {},
    navigateTo: finish, redirectTo: finish, reLaunch: finish, navigateBack: finish,
    ...overrides
  }
  function preprocess(text) {
    const enabled = [true]
    return text.split('\n').filter(line => {
      const start = line.match(/\/\/\s*#ifdef\s+(.*)/)
      if (start) { enabled.push(enabled.at(-1) && start[1].split(/\s*\|\|\s*/).includes(platform)); return false }
      if (/\/\/\s*#endif/.test(line)) { enabled.pop(); return false }
      return enabled.at(-1)
    }).join('\n')
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    let code = preprocess(fs.readFileSync(file, 'utf8'))
    if (file.endsWith('.vue')) code = compileScript(parse(code, { filename: file }).descriptor, { id: 'test' }).content
    code = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require: id => {
        if (id === 'vue') return { ...vue, onBeforeUnmount: register('unmount'), onMounted: register('mount'), getCurrentInstance: () => ({ proxy: {} }) }
        if (id === '@dcloudio/uni-app') return { onShow: register('show'), onHide: register('hide'), onUnload: register('unload'), onResize: register('resize') }
        if (id.endsWith('.vue')) return {}
        if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'))
        return require(id)
      },
      uni, getCurrentPages: () => Array.from({ length: 1 }), console,
      setTimeout: (fn, delay) => { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id },
      setInterval: (fn, delay) => { const id = ++sequence; timers.set(id, { fn, at: now + delay, interval: delay }); return id },
      clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id)
    }, { filename: file })
    return module.exports
  }
  const scope = vue.effectScope()
  const component = load(path.join(root, 'features/resume', name + '.vue')).default
  const exposed = {}
  const screen = scope.run(() => component.setup(props, { expose: value => Object.assign(exposed, value) }))
  function fire(key) { for (const fn of hooks[key] || []) fn() }
  return { screen, exposed, uni, hooks, modals, toasts,
    store: load(path.join(root, 'features/resume/store.ts')),
    load: name => load(path.join(root, 'features/resume', name + '.ts')),
    failWrites: value => { writeError = value }, writes: () => writes, disk: () => clone(disk),
    fire,
    advance(ms) {
      const end = now + ms
      while (true) {
        const pending = [...timers].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!pending) break
        const [id, task] = pending; now = task.at
        if (task.interval) task.at += task.interval; else timers.delete(id)
        task.fn()
      }
      now = end
    },
    dispose() { fire('unmount'); scope.stop(); timers.clear() }
  }
}
module.exports = { harness }
