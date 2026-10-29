import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { z, ZodError } from 'zod'
import type { Config } from './config'
import { openDatabase } from './database'
import { ApiError } from './errors'
import { authenticate, createSession, exchangeWechat, type Fetcher } from './auth'
import { identifier, revision, saveSchema } from './validation'
import { assertPhoto, registerFiles, type Renderer } from './files'
import { registerAi, type AiRunner } from './ai'

interface Row { id: string; title: string; data: string; revision: number; updated_at: number }
const meta = (row: Row) => ({ id: row.id, title: row.title, revision: row.revision, updatedAt: row.updated_at })
export async function buildApp(config: Config, options: { now?: () => number; fetcher?: Fetcher; renderer?: Renderer; aiRunner?: AiRunner } = {}) {
  const now = options.now || Date.now
  // No request logging: auth codes, tokens, URLs with credentials and resume text are private.
  const app = Fastify({ logger: false, bodyLimit: 512 * 1024,
    trustProxy: config.trustLocalProxy ? ['127.0.0.1', '::1', '::ffff:127.0.0.1'] : false, requestTimeout: 15000 })
  const db = openDatabase(config.database)
  let closeFiles: (()=>Promise<void>)|undefined
  let ai: ReturnType<typeof registerAi> | undefined
  app.addHook('onClose', async () => { await ai?.close(); await closeFiles?.(); db.close() })
  await app.register(cors, { origin: config.origins, methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type','Authorization'] })
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff')
    return payload
  })
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: '数据格式不正确', fields: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) } })
    if (error instanceof ApiError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } })
    const errorStatus = (error as {statusCode?:number})?.statusCode
    const status = errorStatus === 429 ? 429 : errorStatus === 413 ? 413 : errorStatus === 400 || errorStatus === 415 ? 400 : 500
    const messages = { 400: '请求格式不正确', 413: '简历内容过大，请减少内容后重试', 429: '操作太频繁，请稍后重试', 500: '服务暂时不可用，请重试' }
    reply.code(status).send({ error: { code: `HTTP_${status}`, message: messages[status] } })
  })
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: '接口不存在' } }))
  app.get('/health', async () => ({ ok: true, service: 'qingyu-api', version: 1,
    developmentLogin: config.developmentLogin, wechatLogin: Boolean(config.appSecret) }))
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }
  app.post('/v1/auth/wechat', authLimit, async request => {
    const { code } = z.object({ code: z.string().min(1).max(512) }).strict().parse(request.body)
    const subject = await exchangeWechat(code, config, options.fetcher || fetch)
    return createSession(db, 'wechat', subject, now(), config.sessionTtl)
  })
  app.post('/v1/auth/development', authLimit, async request => {
    if (!config.developmentLogin || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip)) {
      throw new ApiError(404, 'NOT_FOUND', '接口不存在')
    }
    const { deviceId } = z.object({ deviceId: z.string().regex(/^[a-zA-Z0-9_-]{20,100}$/) }).strict().parse(request.body)
    return createSession(db, 'development', deviceId, now(), config.sessionTtl)
  })
  // Authenticate all business routes. Client-supplied account IDs are never used for ownership.
  const account = (header?: string) => authenticate(db, header, now())
  closeFiles=registerFiles(app,db,account,now,options.renderer).close
  ai=registerAi(app,db,account,now,config.ai,options.aiRunner)
  app.get('/v1/me', async request => ({ user: account(request.headers.authorization).user }))
  app.post('/v1/auth/logout', async request => {
    const { tokenHash } = account(request.headers.authorization)
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash)
    return { ok: true }
  })
  app.delete('/v1/me', async request => {
    const { user } = account(request.headers.authorization)
    z.object({ confirmation: z.literal('DELETE_MY_ACCOUNT') }).strict().parse(request.body)
    db.prepare('DELETE FROM users WHERE id=?').run(user.id)
    ai?.cancelUser(user.id)
    return { ok: true }
  })
  app.get('/v1/resumes', async request => {
    const { user } = account(request.headers.authorization)
    const rows = db.prepare('SELECT id,title,revision,updated_at FROM resumes WHERE user_id=? AND deleted=0 ORDER BY updated_at DESC,id').all(user.id) as unknown as Row[]
    return { resumes: rows.map(meta) }
  })
  app.get('/v1/resumes/:id', async request => {
    const { user } = account(request.headers.authorization)
    const { id } = z.object({ id: identifier }).parse(request.params)
    const row = db.prepare('SELECT * FROM resumes WHERE user_id=? AND id=? AND deleted=0').get(user.id, id) as unknown as Row | undefined
    if (!row) throw new ApiError(404, 'RESUME_NOT_FOUND', '备份不存在或已被删除')
    return { ...meta(row), resume: JSON.parse(row.data) }
  })
  app.put('/v1/resumes/:id', async request => {
    const { user } = account(request.headers.authorization)
    const { id } = z.object({ id: identifier }).parse(request.params)
    const { resume, expectedRevision } = saveSchema.parse(request.body)
    if (resume.id !== id) throw new ApiError(400, 'ID_MISMATCH', '简历 ID 与路径不一致')
    assertPhoto(db,user.id,resume.basic.photoId)
    const updatedAt = now(), data = JSON.stringify(resume)
    db.exec('BEGIN IMMEDIATE')
    try {
      const row = db.prepare('SELECT revision,deleted FROM resumes WHERE user_id=? AND id=?').get(user.id, id) as { revision: number; deleted: number } | undefined
      if (row?.deleted || (!row && expectedRevision !== 0) || (row && row.revision !== expectedRevision)) {
        throw new ApiError(409, 'VERSION_CONFLICT', '服务端版本已变化，未覆盖任何内容。请先导入最新备份，或另存副本。')
      }
      if (!row && Number((db.prepare('SELECT COUNT(*) AS count FROM resumes WHERE user_id=? AND deleted=0').get(user.id) as { count: number }).count) >= 100) {
        throw new ApiError(409, 'RESUME_LIMIT', '最多保留 100 份服务端备份，请先删除不需要的备份')
      }
      const next = expectedRevision + 1
      db.prepare(`INSERT INTO resumes(user_id,id,title,data,revision,updated_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(user_id,id) DO UPDATE SET title=excluded.title,data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at`)
        .run(user.id, id, resume.title, data, next, updatedAt)
      db.exec('COMMIT')
      return { id, title: resume.title, revision: next, updatedAt }
    } catch (error) { db.exec('ROLLBACK'); throw error }
  })
  app.delete('/v1/resumes/:id', async request => {
    const { user } = account(request.headers.authorization)
    const { id } = z.object({ id: identifier }).parse(request.params)
    const { expectedRevision } = z.object({ expectedRevision: revision.min(1) }).strict().parse(request.body)
    // Erase contents but retain the ID tombstone to prevent delayed writes reviving a deleted backup.
    const result = db.prepare("UPDATE resumes SET deleted=1,data='',title='',revision=revision+1 WHERE user_id=? AND id=? AND revision=? AND deleted=0").run(user.id, id, expectedRevision)
    if (!result.changes) {
      const exists = db.prepare('SELECT 1 FROM resumes WHERE user_id=? AND id=? AND deleted=0').get(user.id, id)
      throw new ApiError(exists ? 409 : 404, exists ? 'VERSION_CONFLICT' : 'RESUME_NOT_FOUND', exists ? '备份已更新，请刷新后重新确认删除' : '备份不存在或已被删除')
    }
    return { ok: true }
  })
  await app.ready()
  return app
}
