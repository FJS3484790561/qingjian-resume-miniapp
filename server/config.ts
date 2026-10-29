import { resolve } from 'node:path'

export interface Config {
  host: string
  port: number
  database: string
  developmentLogin: boolean
  trustLocalProxy: boolean
  appId: string
  appSecret: string
  origins: string[]
  sessionTtl: number
  ai: { endpoint: string; apiKey: string; model: string; label: string; timeoutMs: number; dailyLimit: number }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, development = false): Config {
  const host = env.API_HOST || '127.0.0.1'
  const developmentLogin = env.ALLOW_DEV_LOGIN === 'true' || development
  if (developmentLogin && (env.NODE_ENV === 'production' || !['127.0.0.1', '::1'].includes(host))) {
    throw new Error('开发登录只能在非生产环境且绑定回环地址时启用')
  }
  const port = Number(env.API_PORT || 8787)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT 无效')
  const appId = env.WECHAT_APP_ID || 'wxdccead0ec32190d0'
  if (appId !== 'wxdccead0ec32190d0') throw new Error('当前简历项目必须使用 AppID wxdccead0ec32190d0，请勿复用其他小程序配置')
  const appSecret = env.WECHAT_APP_SECRET || ''
  if (env.NODE_ENV === 'production' && !appSecret) throw new Error('生产环境必须配置 WECHAT_APP_SECRET')
  const endpoint = env.AI_API_ENDPOINT?.trim() || ''
  if (endpoint) {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('AI_API_ENDPOINT 必须为无凭据和查询参数的 HTTPS 完整接口地址')
  }
  const timeoutMs = Number(env.AI_TIMEOUT_MS || 30000), dailyLimit = Number(env.AI_DAILY_LIMIT || 20)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new Error('AI_TIMEOUT_MS 应为 1000—60000')
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000) throw new Error('AI_DAILY_LIMIT 应为 1—1000')
  return {
    host, port, developmentLogin, trustLocalProxy: env.TRUST_LOCAL_PROXY === 'true', appId, appSecret,
    database: resolve(env.DATABASE_PATH || 'server/data/qingyu.sqlite'),
    origins: (env.CORS_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
    sessionTtl: 7 * 24 * 60 * 60 * 1000,
    ai: { endpoint, apiKey: env.AI_API_KEY?.trim() || '', model: env.AI_MODEL?.trim() || '',
      label: env.AI_PROVIDER_LABEL?.trim().slice(0, 60) || '', timeoutMs, dailyLimit }
  }
}
