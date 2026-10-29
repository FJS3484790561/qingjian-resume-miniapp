import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Config } from './config'
import { ApiError } from './errors'

export type Fetcher = typeof fetch
export async function exchangeWechat(code: string, config: Config, fetcher: Fetcher) {
  if (!config.appSecret) throw new ApiError(503, 'WECHAT_NOT_CONFIGURED', '服务端尚未配置微信登录')
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.search = new URLSearchParams({ appid: config.appId, secret: config.appSecret, js_code: code, grant_type: 'authorization_code' }).toString()
  let data: Record<string, unknown>
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('upstream')
    data = await response.json() as Record<string, unknown>
  } catch { throw new ApiError(502, 'WECHAT_UNAVAILABLE', '微信登录暂时不可用，请重试') }
  if (data.errcode || typeof data.openid !== 'string' || !data.openid) {
    throw new ApiError(401, 'WECHAT_LOGIN_FAILED', '微信登录凭证无效或已过期，请重新登录')
  }
  // session_key and openid never leave the server or enter application logs.
  return data.openid
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export function createSession(db: DatabaseSync, provider: 'wechat' | 'development', subject: string, now: number, ttl: number) {
  db.prepare('INSERT INTO users(id,provider,subject,created_at) VALUES(?,?,?,?) ON CONFLICT(provider,subject) DO NOTHING')
    .run(randomUUID(), provider, subject, now)
  const user = db.prepare('SELECT id,provider FROM users WHERE provider=? AND subject=?').get(provider, subject) as { id: string; provider: string }
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now)
  const token = randomBytes(32).toString('hex'), expiresAt = now + ttl
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hashToken(token), user.id, expiresAt)
  return { token, expiresAt, user }
}
export function authenticate(db: DatabaseSync, header: string | undefined, now: number) {
  const match = /^Bearer ([0-9a-f]{64})$/.exec(header || '')
  if (!match) throw new ApiError(401, 'UNAUTHORIZED', '请先登录')
  const user = db.prepare(`SELECT users.id,users.provider FROM sessions JOIN users ON users.id=sessions.user_id
    WHERE token_hash=? AND expires_at>?`).get(hashToken(match[1]), now) as { id: string; provider: string } | undefined
  if (!user) throw new ApiError(401, 'SESSION_EXPIRED', '登录已失效，请重新登录')
  return { user, tokenHash: hashToken(match[1]) }
}
