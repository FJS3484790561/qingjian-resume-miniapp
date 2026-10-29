import { existsSync } from 'node:fs'
import { buildApp } from './app'
import { loadConfig } from './config'

async function start() {
  if (existsSync('.env')) process.loadEnvFile('.env')
  const config = loadConfig(process.env, process.argv.includes('--dev'))
  const app = await buildApp(config)
  await app.listen({ host: config.host, port: config.port })
  console.log(`青屿 API 已启动：http://${config.host}:${config.port}（${config.developmentLogin ? '仅本机开发登录' : '微信登录'}）`)
  const stop = async () => { await app.close(); process.exit(0) }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}
start().catch(() => { console.error('API 启动失败，请检查端口、数据库路径和环境配置。'); process.exitCode = 1 })
