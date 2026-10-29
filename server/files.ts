import { randomUUID, createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import sharp from 'sharp'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ApiError } from './errors'
import { identifier, resumeSchema } from './validation'
import { renderDocument, type RenderInput } from './render'

type Auth = (header?: string) => { user: { id: string } }
interface Photo { id: string; data: Uint8Array; width: number; height: number; created_at: number }
interface Job { id: string; user_id: string; request_id: string; digest: string; title: string; format: 'pdf'|'docx'; state: string; snapshot: string; data: Uint8Array|null; error: string; created_at: number; updated_at: number }
export type Renderer = (input: RenderInput, signal: AbortSignal) => Promise<Buffer>
const digest = (value: string|Buffer) => createHash('sha256').update(value).digest('hex')
const photoMeta = (row: Photo) => ({ id: row.id, width: row.width, height: row.height, createdAt: row.created_at })
const jobMeta = (row: Job) => ({ id: row.id, title: row.title, format: row.format, state: row.state, error: row.error,
  size: row.data?.byteLength || 0, createdAt: row.created_at, updatedAt: row.updated_at })
export function assertPhoto(db: DatabaseSync, userId: string, photoId?: string) {
  if (photoId && !db.prepare('SELECT 1 FROM photos WHERE user_id=? AND id=?').get(userId,photoId)) {
    throw new ApiError(400,'PHOTO_NOT_FOUND','照片不存在或不属于当前账号，请重新上传照片')
  }
}
export function registerFiles(app: FastifyInstance, db: DatabaseSync, account: Auth, now: ()=>number, renderer: Renderer = renderDocument) {
  // Interrupted work never becomes a fabricated success after restart.
  db.prepare("UPDATE exports SET state='failed',error='服务重启中断了生成，请重新发起',snapshot='',updated_at=? WHERE state IN ('queued','running')").run(now())
  let closing=false, active: Promise<void>|undefined, controller: AbortController|undefined
  const jobFor = (userId: string,id: string) => {
    const job=db.prepare("SELECT * FROM exports WHERE user_id=? AND id=? AND state!='deleted'").get(userId,id) as unknown as Job|undefined
    if(!job)throw new ApiError(404,'EXPORT_NOT_FOUND','文件记录不存在或已删除')
    return job
  }
  async function drain() {
    while(!closing) {
      const job=db.prepare("SELECT * FROM exports WHERE state='queued' ORDER BY created_at,id LIMIT 1").get() as unknown as Job|undefined
      if(!job)return
      db.prepare("UPDATE exports SET state='running',updated_at=? WHERE id=? AND state='queued'").run(now(),job.id)
      controller=new AbortController()
      const timeout=setTimeout(()=>controller?.abort(),45000)
      try {
        const resume=JSON.parse(job.snapshot)
        const photo=resume.basic.photoId?db.prepare('SELECT * FROM photos WHERE user_id=? AND id=?').get(job.user_id,resume.basic.photoId) as unknown as Photo|undefined:undefined
        if(resume.basic.photoId&&!photo)throw new Error('照片已失效')
        const bytes=await renderer({resume,format:job.format,photo:photo?Buffer.from(photo.data):undefined},controller.signal)
        if(controller.signal.aborted)throw new Error('生成已中断')
        if(bytes.length>10*1024*1024)throw new Error('生成文件超过 10 MB，请减少内容')
        // The single worker serializes capacity checks. Account deletion/cancel wins over late completion.
        const used=db.prepare("SELECT COALESCE(SUM(length(data)),0) AS size FROM exports WHERE user_id=?").get(job.user_id) as {size:number}
        if(used.size+bytes.length>50*1024*1024)throw new Error('文件存储已满，请删除旧文件后重试')
        db.prepare("UPDATE exports SET state='complete',data=?,snapshot='',updated_at=? WHERE id=? AND state='running'").run(bytes,now(),job.id)
      } catch {
        db.prepare("UPDATE exports SET state='failed',error=?,snapshot='',updated_at=? WHERE id=? AND state='running'")
          .run('文件生成未完成，请检查内容或稍后重新生成',now(),job.id)
      } finally { clearTimeout(timeout); controller=undefined }
    }
  }
  const schedule=()=>{if(!active&&!closing){active=Promise.resolve().then(drain).finally(()=>{
    active=undefined
    if(!closing&&db.prepare("SELECT 1 FROM exports WHERE state='queued' LIMIT 1").get())schedule()
  })}}
  const limits={config:{rateLimit:{max:15,timeWindow:'1 minute'}}}
  app.post('/v1/photos',{...limits,bodyLimit:6*1024*1024},async request=>{
    const {user}=account(request.headers.authorization)
    const {dataUrl}=z.object({dataUrl:z.string().max(5600000)}).strict().parse(request.body)
    const match=/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
    if(!match)throw new ApiError(400,'INVALID_PHOTO','请选择 PNG、JPEG 或 WebP 照片')
    const source=Buffer.from(match[1],'base64')
    if(!source.length||source.length>4*1024*1024)throw new ApiError(413,'PHOTO_TOO_LARGE','原照片不能超过 4 MB')
    let data: Buffer, width: number, height: number
    try {
      const image=sharp(source,{limitInputPixels:16000000,animated:false,failOn:'warning'})
      const metadata=await image.metadata()
      if(!['png','jpeg','webp'].includes(metadata.format||'')||(metadata.pages||1)>1)throw new Error('invalid')
      const result=await image.rotate().resize({width:1600,height:2000,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true})
      data=result.data;width=result.info.width;height=result.info.height
    } catch {throw new ApiError(400,'INVALID_PHOTO','照片无法读取或像素过大，请换一张静态照片')}
    const hash=digest(data)
    const existing=db.prepare('SELECT * FROM photos WHERE user_id=? AND digest=?').get(user.id,hash) as unknown as Photo|undefined
    if(existing)return photoMeta(existing)
    const usage=db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(length(data)),0) AS size FROM photos WHERE user_id=?').get(user.id) as {count:number;size:number}
    if(usage.count>=30||usage.size+data.length>20*1024*1024)throw new ApiError(409,'PHOTO_LIMIT','照片最多 30 张且合计 20 MB，请先删除不用的照片')
    const id=randomUUID(),createdAt=now()
    db.prepare('INSERT INTO photos(id,user_id,digest,data,width,height,created_at) VALUES(?,?,?,?,?,?,?)').run(id,user.id,hash,data,width,height,createdAt)
    return {id,width,height,createdAt}
  })
  app.get('/v1/photos',async request=>{
    const {user}=account(request.headers.authorization)
    const rows=db.prepare('SELECT id,width,height,created_at FROM photos WHERE user_id=? ORDER BY created_at DESC').all(user.id) as unknown as Photo[]
    return {photos:rows.map(photoMeta)}
  })
  app.get('/v1/photos/:id',async request=>{
    const {user}=account(request.headers.authorization),{id}=z.object({id:identifier}).parse(request.params)
    const row=db.prepare('SELECT * FROM photos WHERE user_id=? AND id=?').get(user.id,id) as unknown as Photo|undefined
    if(!row)throw new ApiError(404,'PHOTO_NOT_FOUND','照片不存在或已被删除')
    return {...photoMeta(row),dataUrl:'data:image/png;base64,'+Buffer.from(row.data).toString('base64')}
  })
  app.delete('/v1/photos/:id',async request=>{
    const {user}=account(request.headers.authorization),{id}=z.object({id:identifier}).parse(request.params)
    const referenced=db.prepare("SELECT 1 FROM resumes WHERE user_id=? AND deleted=0 AND json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END,'$.basic.photoId')=? UNION ALL SELECT 1 FROM exports WHERE user_id=? AND state IN ('queued','running') AND json_extract(CASE WHEN json_valid(snapshot) THEN snapshot ELSE '{}' END,'$.basic.photoId')=? LIMIT 1").get(user.id,id,user.id,id)
    if(referenced)throw new ApiError(409,'PHOTO_IN_USE','照片正在被备份或生成任务使用，请先移除引用')
    if(!db.prepare('DELETE FROM photos WHERE user_id=? AND id=?').run(user.id,id).changes)throw new ApiError(404,'PHOTO_NOT_FOUND','照片不存在或已被删除')
    return {ok:true}
  })
  app.post('/v1/exports',limits,async(request,reply)=>{
    const {user}=account(request.headers.authorization)
    const input=z.object({requestId:identifier,resume:resumeSchema,format:z.enum(['pdf','docx'])}).strict().parse(request.body)
    const snapshot=JSON.stringify(input.resume),hash=digest(JSON.stringify({resume:input.resume,format:input.format}))
    const previous=db.prepare('SELECT * FROM exports WHERE user_id=? AND request_id=?').get(user.id,input.requestId) as unknown as Job|undefined
    if(previous){if(previous.digest!==hash||previous.state==='deleted')throw new ApiError(409,'REQUEST_CONFLICT','该请求已使用，请重新发起');return jobMeta(previous)}
    assertPhoto(db,user.id,input.resume.basic.photoId)
    const usage=db.prepare("SELECT COUNT(*) AS count,SUM(CASE WHEN state IN ('queued','running') THEN 1 ELSE 0 END) AS pending FROM exports WHERE user_id=? AND state!='deleted'").get(user.id) as {count:number;pending:number}
    const globalPending=db.prepare("SELECT COUNT(*) AS count FROM exports WHERE state IN ('queued','running')").get() as {count:number}
    if(usage.count>=50)throw new ApiError(409,'EXPORT_LIMIT','最多保留 50 条文件记录，请先删除旧记录')
    if(usage.pending>=3||globalPending.count>=20)throw new ApiError(429,'EXPORT_BUSY','生成队列繁忙，请等待已有任务完成')
    const id=randomUUID(),time=now()
    db.prepare("INSERT INTO exports(id,user_id,request_id,digest,title,format,state,snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,'queued',?,?,?)")
      .run(id,user.id,input.requestId,hash,input.resume.title,input.format,snapshot,time,time)
    reply.code(202);const result=jobMeta(jobFor(user.id,id));schedule();return result
  })
  app.get('/v1/exports',async request=>{
    const {user}=account(request.headers.authorization)
    const rows=db.prepare("SELECT id,title,format,state,error,created_at,updated_at,length(data) AS bytes FROM exports WHERE user_id=? AND state!='deleted' ORDER BY created_at DESC,id").all(user.id) as unknown as (Job&{bytes:number})[]
    return {exports:rows.map(row=>({...jobMeta(row),size:row.bytes||0}))}
  })
  app.get('/v1/exports/:id',async request=>{
    const {user}=account(request.headers.authorization),{id}=z.object({id:identifier}).parse(request.params)
    return jobMeta(jobFor(user.id,id))
  })
  app.get('/v1/exports/:id/file',async(request,reply)=>{
    const {user}=account(request.headers.authorization),{id}=z.object({id:identifier}).parse(request.params)
    const job=jobFor(user.id,id)
    if(job.state!=='complete'||!job.data)throw new ApiError(409,'FILE_NOT_READY','文件尚未生成成功')
    const name=job.title.replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g,'_').slice(0,60)+'.'+job.format
    return reply.type(job.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .header('Content-Disposition',`attachment; filename="resume.${job.format}"; filename*=UTF-8''${encodeURIComponent(name)}`).send(Buffer.from(job.data))
  })
  app.post('/v1/exports/:id/cancel',async request=>{
    const {user}=account(request.headers.authorization),{id}=z.object({id:identifier}).parse(request.params)
    const job=jobFor(user.id,id)
    if(job.state==='complete')throw new ApiError(409,'ALREADY_COMPLETE','文件已完成，可在下载记录查看或删除')
    const changed=db.prepare("UPDATE exports SET state='cancelled',snapshot='',updated_at=? WHERE user_id=? AND id=? AND state IN ('queued','running')").run(now(),user.id,id)
    if(changed.changes&&active&&job.state==='running')controller?.abort()
    return jobMeta(jobFor(user.id,id))
  })
  app.delete('/v1/exports/:id',async request=>{
    const {user}=account(request.headers.authorization),{id}=z.object({id:identifier}).parse(request.params)
    const job=jobFor(user.id,id)
    if(job.state==='queued'||job.state==='running')throw new ApiError(409,'EXPORT_RUNNING','请先取消生成，再删除记录')
    db.prepare("UPDATE exports SET state='deleted',snapshot='',data=NULL,title='',error='',updated_at=? WHERE user_id=? AND id=?").run(now(),user.id,id)
    return {ok:true}
  })
  return {async close(){closing=true;controller?.abort();await active}}
}
