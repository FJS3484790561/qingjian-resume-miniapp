import { reactive } from 'vue'
import type { Resume } from './schema'

// Build-time public URL only. Secrets belong exclusively in server/.env configuration.
export const apiBase = typeof __QINGYU_API_BASE__ === 'string' ? __QINGYU_API_BASE__ : 'http://127.0.0.1:8787'
const SESSION_KEY = 'qingyu-api-session:v1'
const DEVICE_KEY = 'qingyu-development-device:v1'
export interface User { id:string; provider:'wechat'|'development' }
export interface Session { token:string; expiresAt:number; user:User }
export interface BackupMeta { id:string; title:string; revision:number; updatedAt:number }
export interface Backup extends BackupMeta { resume:Resume }
export class RequestError extends Error {
 constructor(public code:string,message:string,public status=0){super(message)}
}
function storedSession():Session|null {
 try {const value=uni.getStorageSync(SESSION_KEY);return value&&typeof value.token==='string'&&/^[a-f0-9]{64}$/.test(value.token)&&value.expiresAt>Date.now()&&typeof value.user?.id==='string'&&['wechat','development'].includes(value.user?.provider)?value:null} catch{return null}
}
export const account=reactive<{session:Session|null}>({session:storedSession()})
function clearSession() {
 account.session=null
 // An expired disk session is harmless: every API request is still authenticated server-side.
 try{uni.removeStorageSync(SESSION_KEY)}catch{}
}
export function request<T>(path:string,method:'GET'|'POST'|'PUT'|'DELETE'='GET',data?:unknown,authenticated=true):Promise<T> {
 const token=authenticated?account.session?.token:undefined
 if(authenticated&&!token)return Promise.reject(new RequestError('UNAUTHORIZED','请先登录'))
 return new Promise((resolve,reject)=>{
  uni.request({url:apiBase+path,method,data:(data??(method==='GET'?undefined:{})) as any,timeout:12000,
   header:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
   success:r=>{
    const body=r.data as any
    if(r.statusCode>=200&&r.statusCode<300){resolve(body as T);return}
    if(r.statusCode===401&&token&&account.session?.token===token)clearSession()
    const fields=body?.error?.fields?.slice(0,3).map((f:any)=>f.path+'：'+f.message).join('；')
    reject(new RequestError(body?.error?.code||'HTTP_'+r.statusCode,fields||body?.error?.message||'服务请求未完成，请重试',r.statusCode))
   },fail:()=>reject(new RequestError('NETWORK_ERROR','无法连接后端，请确认服务已启动且网络可用。原有本机简历保留。'))
  })
 })
}
export async function login(provider:'wechat'|'development') {
 let data:Record<string,string>
 if(provider==='wechat') {
  const code=await new Promise<string>((resolve,reject)=>uni.login({provider:'weixin',success:r=>r.code?resolve(r.code):reject(new Error('未获取到微信登录凭证')),fail:()=>reject(new Error('微信登录未完成，请重试'))}))
  data={code}
 } else {
  let deviceId=uni.getStorageSync(DEVICE_KEY)
  if(typeof deviceId!=='string'||!/^[a-zA-Z0-9_-]{20,100}$/.test(deviceId)){
   deviceId='dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2)
   try{uni.setStorageSync(DEVICE_KEY,deviceId)}catch{throw new Error('本机无法保存测试账号标识，请重试')}
  }
  data={deviceId}
 }
 const session=await request<Session>('/v1/auth/'+provider,'POST',data,false)
 try{uni.setStorageSync(SESSION_KEY,session)}catch{
  // Revoke a token that cannot be durably stored; do not report login success.
  account.session=session
  try{await request('/v1/auth/logout','POST')}finally{clearSession()}
  throw new Error('登录信息无法保存，请重试')
 }
 account.session=session
 return session
}
export async function logout() {
 const token=account.session?.token
 try{await request('/v1/auth/logout','POST')}catch(e){if(!(e instanceof RequestError&&e.status===401))throw e}
 if(account.session?.token===token)clearSession()
}
export async function deleteAccount() {
 const userId=account.session?.user.id
 await request('/v1/me','DELETE',{confirmation:'DELETE_MY_ACCOUNT'})
 if(account.session?.user.id===userId)clearSession()
}
export const getService=()=>request<{ok:boolean;developmentLogin:boolean;wechatLogin:boolean}>('/health','GET',undefined,false)
export interface AiService { enabled:boolean; provider:string; model:string }
export interface AiJob { id:string; state:'queued'|'running'|'complete'|'failed'|'cancelled'; result:string; error:string; expired?:boolean }
export interface AiUsage { attempts:number; completed:number; inputTokens:number; outputTokens:number; dailyLimit:number; windowHours:number }
export const getAiService=()=>request<AiService>('/v1/ai/service','GET',undefined,false)
export const getAiUsage=()=>request<AiUsage>('/v1/ai/usage')
export const createAiJob=(source:string,section:string,requestId:string,service:AiService)=>request<AiJob>('/v1/ai/jobs','POST',{source,section,requestId,consent:true,service:{provider:service.provider,model:service.model}})
export const getAiJob=(id:string)=>request<AiJob>('/v1/ai/jobs/'+encodeURIComponent(id))
export const cancelAiJob=(id:string)=>request<AiJob>('/v1/ai/jobs/'+encodeURIComponent(id)+'/cancel','POST')
export const getBackups=()=>request<{resumes:BackupMeta[]}>('/v1/resumes')
export const getBackup=(id:string)=>request<Backup>('/v1/resumes/'+encodeURIComponent(id))
export const putBackup=(resume:Resume,expectedRevision:number)=>request<BackupMeta>('/v1/resumes/'+encodeURIComponent(resume.id),'PUT',{resume,expectedRevision})
export const deleteBackup=(id:string,expectedRevision:number)=>request('/v1/resumes/'+encodeURIComponent(id),'DELETE',{expectedRevision})

export interface PrivatePhoto {id:string;width:number;height:number;createdAt:number}
export interface ExportRecord {id:string;title:string;format:'pdf'|'docx';state:'queued'|'running'|'complete'|'failed'|'cancelled';error:string;size:number;createdAt:number;updatedAt:number}
export const getPhotos=()=>request<{photos:PrivatePhoto[]}>('/v1/photos')
export const deletePhoto=(id:string)=>request('/v1/photos/'+encodeURIComponent(id),'DELETE')
export const getPhoto=(id:string)=>request<PrivatePhoto&{dataUrl:string}>('/v1/photos/'+encodeURIComponent(id))
export const getExports=()=>request<{exports:ExportRecord[]}>('/v1/exports')
export const getExport=(id:string)=>request<ExportRecord>('/v1/exports/'+encodeURIComponent(id))
export const createExport=(resume:Resume,format:'pdf'|'docx',requestId:string)=>request<ExportRecord>('/v1/exports','POST',{resume,format,requestId})
export const cancelExport=(id:string)=>request<ExportRecord>('/v1/exports/'+encodeURIComponent(id)+'/cancel','POST')
export const deleteExport=(id:string)=>request('/v1/exports/'+encodeURIComponent(id),'DELETE')
export function sameSession(token?:string) {if(!token||account.session?.token!==token)throw new Error('登录账号已变化，本次操作已停止，请重新发起')}
export async function snapshotForServer(resume:Resume,token=account.session?.token):Promise<Resume> {
 sameSession(token)
 const snapshot=JSON.parse(JSON.stringify(resume)) as Resume
 const localPhoto=snapshot.basic.photo
 delete snapshot.basic.photo;delete snapshot.basic.photoId
 if(localPhoto){
  let dataUrl=localPhoto
  if(!localPhoto.startsWith('data:image/')) {
   // #ifdef H5
   if(!localPhoto.startsWith('blob:'))throw new Error('照片地址已失效，请重新选择本机照片')
   const response=await fetch(localPhoto);if(!response.ok)throw new Error('照片读取失败')
   const blob=await response.blob()
   dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('照片读取失败'));reader.readAsDataURL(blob)})
   // #endif
   // #ifdef MP-WEIXIN
   dataUrl=await new Promise<string>((resolve,reject)=>uni.getFileSystemManager().readFile({filePath:localPhoto,encoding:'base64',success:r=>resolve('data:image/png;base64,'+r.data),fail:()=>reject(new Error('照片读取失败，请重新选择本机照片'))}))
   // #endif
  }
  if(dataUrl.length>5600000)throw new Error('照片不能超过 4 MB，请选择较小的照片')
  sameSession(token)
  const photo=await request<PrivatePhoto>('/v1/photos','POST',{dataUrl})
  sameSession(token);snapshot.basic.photoId=photo.id
 }
 return snapshot
}
export async function hydrateServerResume(resume:Resume,token=account.session?.token):Promise<Resume> {
 sameSession(token)
 const snapshot=JSON.parse(JSON.stringify(resume)) as Resume
 const photoId=snapshot.basic.photoId;delete snapshot.basic.photoId
 if(photoId){const photo=await getPhoto(photoId);sameSession(token);snapshot.basic.photo=photo.dataUrl}
 return snapshot
}
export async function downloadExport(record:ExportRecord,stillCurrent:()=>boolean=()=>true) {
 const token=account.session?.token;sameSession(token)
 const url=apiBase+'/v1/exports/'+encodeURIComponent(record.id)+'/file'
 // #ifdef H5
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error?.message||'文件下载失败，请重新登录或稍后重试')}
 const blob=await response.blob();sameSession(token)
 if(!stillCurrent())throw new Error('页面已变化，已停止打开文件，可从下载记录重试')
 const objectUrl=URL.createObjectURL(blob),link=document.createElement('a')
 link.href=objectUrl;link.download=record.title.replace(/[\\/:*?"<>|]/g,'_')+'.'+record.format
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),30000)
 // #endif
 // #ifdef MP-WEIXIN
 const path=await new Promise<string>((resolve,reject)=>uni.downloadFile({url,header:{Authorization:'Bearer '+token},timeout:60000,success:r=>r.statusCode===200?resolve(r.tempFilePath):reject(new Error('文件下载失败，请重新登录或稍后重试')),fail:()=>reject(new Error('文件下载中断，请重试'))}))
 sameSession(token)
 if(!stillCurrent())throw new Error('页面已变化，已停止打开文件，可从下载记录重试')
 await new Promise<void>((resolve,reject)=>uni.openDocument({filePath:path,fileType:record.format,showMenu:true,success:()=>resolve(),fail:()=>reject(new Error('文件已下载，但未能打开。请在记录中重试，或换手机查看。'))}))
 // #endif
}
