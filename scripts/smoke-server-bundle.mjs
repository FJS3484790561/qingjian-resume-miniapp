import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { createServer } from 'node:net'
import assert from 'node:assert/strict'

const directory = await mkdtemp(join(tmpdir(), 'qingyu-bundle-'))
const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
const child = spawn(process.execPath, ['--experimental-sqlite', resolve('dist/server/index.cjs')], { cwd: directory,
  env: { ...process.env, NODE_ENV: 'test', API_PORT: String(port), API_HOST: '127.0.0.1', DATABASE_PATH: join(directory, 'data.sqlite'),
    ALLOW_DEV_LOGIN: 'false', WECHAT_APP_SECRET: '', AI_API_KEY: '', AI_API_ENDPOINT: '', AI_MODEL: '', AI_PROVIDER_LABEL: '' },
  stdio: ['ignore', 'pipe', 'pipe'] })
let failure = ''
child.stderr.on('data', chunk => { failure += chunk.toString() })
try {
  let ready = false
  for (let n = 0; n < 60; n++) {
    if (child.exitCode !== null) throw new Error('bundle exited before startup: ' + failure)
    try { const response = await fetch(`http://127.0.0.1:${port}/health`); ready = response.ok; if (ready) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(ready, true, failure)
  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json()
  assert.equal(health.developmentLogin, false)
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/v1/ai/service`)).json()).enabled, false)
  assert.equal((await fetch(`http://127.0.0.1:${port}/v1/auth/development`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404)
  console.log('打包产物独立启动通过：健康检查、AI 未配置状态、开发登录关闭。')
} finally {
  if (child.exitCode === null) { const exit = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exit }
  await rm(directory, { recursive: true, force: true })
}
