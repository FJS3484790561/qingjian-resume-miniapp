import { computed, reactive } from 'vue'
import { definitions, makeResume, type Resume, type ModuleId, type Entry } from './schema'
const KEY='qingyu-frontend:v1'
interface State { version:1; resumes:Resume[]; currentId:string; reduced:boolean; agreed:boolean; member:number|null; exports:{id:string;title:string;time:number;type:string}[]; simulation:'success'|'error'|'quota' }
function initial():State { const resume=makeResume(true);return {version:1,resumes:[resume],currentId:resume.id,reduced:false,agreed:false,member:null,exports:[],simulation:'success'} }
function read():State {try {const value=uni.getStorageSync(KEY);if(value?.version===1&&Array.isArray(value.resumes)&&value.resumes.length&&value.resumes.every((r:Resume)=>r.basic&&r.modules&&r.layout&&definitions.every(d=>r.modules[d.id]&&Array.isArray(r.modules[d.id].entries))))return {...initial(),...value}}catch{}return initial()}
export const state=reactive<State>(read())
export const currentResume=computed(()=>state.resumes.find(r=>r.id===state.currentId)||state.resumes[0])
export const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
export function persist() { try{uni.setStorageSync(KEY,clone(state));return true}catch{uni.showToast({title:'本机存储失败，请保留当前页面后重试',icon:'none'});return false} }
export function updateResume(update:(r:Resume)=>void) { const next=clone(currentResume.value);update(next);next.updatedAt=Date.now();try {const all=clone(state);all.resumes=all.resumes.map(r=>r.id===next.id?next:r);uni.setStorageSync(KEY,all);Object.assign(currentResume.value,next);return true}catch{uni.showToast({title:'保存失败，输入仍保留，请重试',icon:'none'});return false} }
export function saveModule(id:ModuleId,entry:Entry) {return updateResume(r=>{const entries=r.modules[id].entries;const i=entries.findIndex(e=>e.id===entry.id);if(i>=0)entries[i]=clone(entry);else entries.push(clone(entry))})}
export function createResume(sample=false) {const resume=makeResume(sample);state.resumes.unshift(resume);state.currentId=resume.id;persist();return resume}
export function activateResume(id:string) {state.currentId=id;persist()}
export function removeResume(id:string) {state.resumes=state.resumes.filter(r=>r.id!==id);if(!state.resumes.length){const empty=makeResume();state.resumes.push(empty)}state.currentId=state.resumes[0].id;persist()}
export function resetLocal() {Object.assign(state,initial());persist()}
export function message(title:string) {uni.showToast({title,icon:'none'})}
