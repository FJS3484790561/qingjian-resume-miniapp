import { computed, reactive } from 'vue'
import { definitions, makeResume, plans, type Resume, type ModuleId, type Entry } from './schema'
const KEY='qingyu-frontend:v1'
export interface BackupBinding { userId:string; remoteId:string; revision:number }
interface State { version:1; resumes:Resume[]; currentId:string; reduced:boolean; agreed:boolean; member:number|null; exports:{id:string;title:string;time:number;type:string}[]; simulation:'success'|'error'|'quota'; backups?:Record<string,BackupBinding> }
function initial():State { const resume=makeResume(true);return {version:1,resumes:[resume],currentId:resume.id,reduced:false,agreed:false,member:null,exports:[],simulation:'success',backups:{}} }
export const storageStatus=reactive({blocked:false,error:''})
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const strings=(v:unknown)=>record(v)&&Object.values(v).every(item=>typeof item==='string')
export function validResume(r:unknown):r is Resume {
 if(!record(r)||typeof r.id!=='string'||!r.id||typeof r.title!=='string'||!Number.isFinite(r.updatedAt)||typeof r.sample!=='boolean'||typeof r.chronological!=='boolean'||!strings(r.basic)||!record(r.modules)||!record(r.layout))return false
 if(!definitions.every(d=>{const m=r.modules[d.id];return record(m)&&typeof m.name==='string'&&typeof m.visible==='boolean'&&Array.isArray(m.entries)&&m.entries.every((e:unknown)=>strings(e)&&record(e)&&typeof e.id==='string'&&!!e.id)&&new Set(m.entries.map((e:Entry)=>e.id)).size===m.entries.length}))return false
 if(!Array.isArray(r.order)||r.order.length!==definitions.length||new Set(r.order).size!==definitions.length||!r.order.every((id:unknown)=>definitions.some(d=>d.id===id)))return false
 return ['templateId','color','cover'].every(key=>typeof r.layout[key]==='string')&&['font','line','gap'].every(key=>Number.isInteger(r.layout[key])&&r.layout[key]>=0&&r.layout[key]<=4)
}
function read():State {
 storageStatus.blocked=false;storageStatus.error=''
 try {
  const value=uni.getStorageSync(KEY)
  if(value===''||value===undefined||value===null)return initial()
  if(!record(value)||value.version!==1||!Array.isArray(value.resumes)||!value.resumes.length||!value.resumes.every(validResume)||new Set(value.resumes.map((r:Resume)=>r.id)).size!==value.resumes.length)throw new Error('invalid drafts')
  if(typeof value.reduced!=='boolean'||typeof value.agreed!=='boolean'||!(value.member===null||Number.isInteger(value.member)&&value.member>=0&&value.member<plans.length)||!['success','error','quota'].includes(value.simulation))throw new Error('invalid settings')
  if(!Array.isArray(value.exports)||!value.exports.every((e:unknown)=>record(e)&&typeof e.id==='string'&&typeof e.title==='string'&&Number.isFinite(e.time)&&typeof e.type==='string'))throw new Error('invalid records')
  if(value.backups!==undefined&&(!record(value.backups)||!Object.values(value.backups).every((b:unknown)=>record(b)&&typeof b.userId==='string'&&typeof b.remoteId==='string'&&Number.isInteger(b.revision)&&b.revision>0)))throw new Error('invalid backup metadata')
  return {...value,currentId:value.resumes.some((r:Resume)=>r.id===value.currentId)?value.currentId:value.resumes[0].id} as State
 } catch {storageStatus.blocked=true;storageStatus.error='本机草稿暂时无法读取，原数据未覆盖。请重试读取；确认不需要原数据后，可在设置中清空本机体验数据。';return initial()}
}
export const state=reactive<State>(read())
export const currentResume=computed(()=>state.resumes.find(r=>r.id===state.currentId)||state.resumes[0])
export const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
export function reloadLocal() {const next=read();if(storageStatus.blocked){message('仍无法读取，原数据未覆盖');return false}Object.assign(state,next);message('已重新读取本机草稿');return true}
export function updateResume(update:(r:Resume)=>void) {
 return updateState(next=>{const resume=next.resumes.find(r=>r.id===next.currentId)||next.resumes[0];update(resume);resume.updatedAt=Date.now()})
}
export function saveModule(id:ModuleId,entry:Entry) {return updateResume(r=>{const entries=r.modules[id].entries;const i=entries.findIndex(e=>e.id===entry.id);if(i>=0)entries[i]=clone(entry);else entries.push(clone(entry))})}
export function updateState(update:(next:State)=>void,allowRecovery=false) {
 if(storageStatus.blocked&&!allowRecovery){message('请先重试读取本机草稿，原数据未覆盖');return false}
 const next=clone(state);update(next)
 try {uni.setStorageSync(KEY,next);Object.assign(state,next);storageStatus.blocked=false;storageStatus.error='';return true}
 catch {message('本机保存失败，原有数据未变，请重试');return false}
}
export function createResume(sample=false,prepare?:(resume:Resume)=>void):Resume|null {
 const resume=makeResume(sample);prepare?.(resume)
 return updateState(next=>{next.resumes.unshift(resume);next.currentId=resume.id})?resume:null
}
export function activateResume(id:string) {
 if(!state.resumes.some(r=>r.id===id)){message('这份草稿已不存在，请重新选择');return false}
 if(state.currentId===id)return true
 return updateState(next=>{next.currentId=id})
}
export function removeResume(id:string) {
 if(!state.resumes.some(r=>r.id===id)){message('这份草稿已不存在，请重新选择');return false}
 return updateState(next=>{
  next.resumes=next.resumes.filter(r=>r.id!==id)
  if(!next.resumes.length)next.resumes.push(makeResume())
  if(!next.resumes.some(r=>r.id===next.currentId))next.currentId=next.resumes[0].id
 })
}
export function resetLocal() {return updateState(next=>Object.assign(next,initial()),true)}
export function backupBinding(localId:string,userId:string) {const b=state.backups?.[userId+':'+localId];return b&&b.userId===userId&&typeof b.remoteId==='string'&&Number.isInteger(b.revision)&&b.revision>0?b:undefined}
export function saveBackupBinding(localId:string,binding:BackupBinding) {
 if(!state.resumes.some(r=>r.id===localId))return false
 return updateState(next=>{(next.backups||={})[binding.userId+':'+localId]=binding})
}
export function importBackup(resume:Resume,binding:BackupBinding) {
 if(!validResume(resume))return null
 const imported=clone(resume);imported.id=makeResume().id;imported.updatedAt=Date.now()
 return updateState(next=>{next.resumes.unshift(imported);next.currentId=imported.id;(next.backups||={})[binding.userId+':'+imported.id]=binding})?imported:null
}
export function message(title:string) {uni.showToast({title,icon:'none'})}
