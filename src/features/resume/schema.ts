export type ModuleId = 'intention'|'education'|'campus'|'internship'|'work'|'project'|'skills'|'certificates'|'interests'|'evaluation'|'exam'|'letter'|'custom1'|'custom2'|'custom3'|'custom4'
export interface Field { key:string; label:string; kind?:'text'|'number'|'select'|'month'|'date'|'rich'|'salary'; options?:string[]; max?:number; hint?:string }
export interface ModuleDefinition { id:ModuleId; name:string; icon:string; multi?:boolean; description:string; fields:Field[] }
export type Entry = { id:string; [key:string]:string }
export interface ModuleState { name:string; visible:boolean; entries:Entry[] }
export interface Resume {
  id:string; title:string; updatedAt:number; sample:boolean; basic:Record<string,string>;
  modules:Record<ModuleId,ModuleState>; order:ModuleId[]; chronological:boolean;
  layout:{ templateId:string; color:string; cover:string; font:number; line:number; gap:number }
}
const period:Field[] = [{key:'start',label:'开始时间',kind:'month'},{key:'end',label:'结束时间',kind:'month',hint:'结束时间可以设为「至今」'}]
const rich=(key:string,label:string):Field=>({key,label,kind:'rich',max:10000})
const career=(name:string):Field[]=>[...period,{key:'name',label:'公司名称',max:60},{key:'role',label:'工作职位',max:15},rich('content',name+'内容')]
const tags=(label:string):Field[]=>Array.from({length:15},(_,i)=>({key:'item'+(i+1),label:label+' '+(i+1),max:100}))
const customFields:Field[]=[...period,{key:'name',label:'名称',max:60},{key:'role',label:'角色',max:40},rich('content','自定义内容')]
export const definitions:ModuleDefinition[] = [
 {id:'intention',name:'求职意向',icon:'briefcase',description:'和适合的机会相遇',fields:[{key:'role',label:'期望职位',max:15},{key:'city',label:'期望地点',max:15},{key:'salary',label:'期望薪资',kind:'salary'},{key:'status',label:'求职状态',max:40}]},
 {id:'education',name:'教育经历',icon:'school',multi:true,description:'每一份积累，都有来处',fields:[...period,{key:'degree',label:'学历',kind:'select',options:['博士','硕士','本科','大专','中专','高中','其他']},{key:'name',label:'学校名称',max:60},{key:'major',label:'专业名称',max:60},rich('content','专业课程')]},
 {id:'campus',name:'在校经历',icon:'school',multi:true,description:'记录校园里的闪光时刻',fields:[...period,{key:'name',label:'经历名称',max:20,hint:'社团、职务、奖学金、竞赛等'},{key:'role',label:'担任角色',max:40},rich('content','经历描述')]},
 {id:'internship',name:'实习经历',icon:'briefcase',multi:true,description:'把第一次实践写清楚',fields:career('工作')},
 {id:'work',name:'工作经历',icon:'briefcase',multi:true,description:'让成果与能力被看见',fields:career('工作')},
 {id:'project',name:'项目经历',icon:'folder',multi:true,description:'你做过的事，就是最好的证明',fields:[...period,{key:'name',label:'项目名称',max:20},{key:'role',label:'担任角色',max:40},rich('content','项目内容')]},
 {id:'skills',name:'职业技能',icon:'sparkle',description:'清晰展示你的拿手本领',fields:tags('职业技能')},
 {id:'certificates',name:'奖项证书',icon:'file',description:'认真努力的每一份证明',fields:tags('奖项证书')},
 {id:'interests',name:'兴趣爱好',icon:'leaf',description:'还有这些热爱的事',fields:tags('兴趣爱好')},
 {id:'evaluation',name:'自我评价',icon:'edit',description:'用自己的话，介绍自己',fields:[rich('content','自我评价')]},
 {id:'exam',name:'报考信息',icon:'school',description:'向理想的学校再靠近一步',fields:[{key:'name',label:'报考学校',max:60},{key:'major',label:'报考专业',max:60},{key:'score',label:'总分数',kind:'number'},...Array.from({length:5},(_,i)=>[{key:'subject'+i,label:'科目 '+(i+1)+' 名称',max:30},{key:'score'+i,label:'科目 '+(i+1)+' 成绩',kind:'number' as const}]).flat()]},
 {id:'letter',name:'自荐信',icon:'mail',description:'让文字传达你的诚意',fields:[{key:'salutation',label:'尊称',max:60,hint:'例如：尊敬的招聘负责人'},{key:'author',label:'自荐人',max:30},{key:'date',label:'自荐日期',kind:'date'},rich('content','自荐内容')]},
 ...[1,2,3,4].map(n=>({id:('custom'+n) as ModuleId,name:'自定义 '+n,icon:'plus',description:'给特别的经历，一块自己的空间',fields:customFields}))
]
export const basicFields:Field[] = [
 {key:'name',label:'姓名',max:30},{key:'gender',label:'性别',kind:'select',options:['男','女']},{key:'phone',label:'电话',max:25},
 {key:'city',label:'现居城市',max:15},{key:'email',label:'电子邮箱',max:80},{key:'wechat',label:'微信',max:60},{key:'age',label:'年龄',kind:'number',max:3},
 {key:'birth',label:'出生年月',kind:'month'},{key:'marriage',label:'婚姻状况',kind:'select',options:['未婚','已婚','保密']},
 {key:'politics',label:'政治面貌',kind:'select',options:['中共党员','预备党员','共青团员','群众','民主党派','其他']},
 {key:'ethnicity',label:'民族',max:20},{key:'hometown',label:'籍贯',max:15},{key:'height',label:'身高（CM）',kind:'number',max:3},{key:'weight',label:'体重（KG）',kind:'number',max:3},
 {key:'school',label:'学校',max:60},{key:'major',label:'专业',max:60},{key:'degree',label:'学历',max:30},
 {key:'customTitle1',label:'自定义标题 1',max:20},{key:'customContent1',label:'自定义内容 1',max:100},{key:'customTitle2',label:'自定义标题 2',max:20},{key:'customContent2',label:'自定义内容 2',max:100}
]
export const plain=(html='')=>html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim()
export const escapeHtml=(s='')=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
export function entryHasContent(entry:Entry) { return Object.entries(entry).some(([k,v])=>k!=='id' && plain(v).trim()) }
export function filledModules(resume:Resume) { return resume.order.filter(id=>resume.modules[id].entries.some(entryHasContent)) }
export function sortedEntries(resume:Resume,id:ModuleId) {
 const entries=resume.modules[id].entries.filter(entryHasContent)
 return [...entries].sort((a,b)=>{const first=a.end==='至今'?'9999-12':a.end||a.start||'';const second=b.end==='至今'?'9999-12':b.end||b.start||'';return (resume.chronological?1:-1)*first.localeCompare(second)})
}
export function validateFields(values:Record<string,string>,fields:Field[]) {
 const errors:Record<string,string>={}
 for(const field of fields) if(field.max&&plain(values[field.key]).length>field.max) errors[field.key]=`请控制在 ${field.max} 字以内`
 if(values.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email='邮箱格式不正确，例如 name@example.com'
 if(values.phone&&!/^[+\d][\d\s()-]{5,24}$/.test(values.phone)) errors.phone='请填写有效电话号码，或暂时留空'
 if(values.start&&values.end&&values.end!=='至今'&&values.start>values.end) errors.end='结束时间不能早于开始时间'
 return errors
}
export function makeResume(sample=false):Resume {
 const modules=Object.fromEntries(definitions.map(d=>[d.id,{name:d.name,visible:true,entries:[]}])) as unknown as Record<ModuleId,ModuleState>
 const resume:Resume={id:'resume-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),title:sample?'林知夏的求职简历':'我的求职简历',updatedAt:Date.now(),sample,basic:{},modules,order:definitions.map(d=>d.id),chronological:false,layout:{templateId:'clear',color:'#416D5B',cover:'none',font:2,line:2,gap:2}}
 if(sample) {
 resume.basic={name:'林知夏',gender:'女',phone:'13800000000',email:'zhixia@example.com',city:'杭州'}
 modules.intention.entries=[{id:'sample-intention',role:'产品设计师',city:'杭州',salary:'面议',status:'应届毕业生，随时到岗'}]
 modules.education.entries=[{id:'sample-education',start:'2022-09',end:'2026-06',name:'南方设计学院',degree:'本科',major:'工业设计',content:'<p>主修课程：设计方法、用户研究、交互设计、产品策略。</p>'}]
 modules.project.entries=[{id:'sample-project',start:'2025-03',end:'2025-09',name:'校园生活服务平台',role:'产品设计',content:'<p>参与 8 场用户访谈，梳理预约服务的关键路径，完成 12 个核心页面设计，让操作更清晰、便捷。</p>'}]
 modules.skills.entries=[{id:'sample-skills',item1:'Figma',item2:'交互设计',item3:'用户研究',item4:'原型制作'}]
 }
 return resume
}
export const photoSpecs=[{name:'一寸',mm:'25 × 35',width:295,height:413},{name:'二寸',mm:'35 × 49',width:413,height:579},{name:'小一寸',mm:'22 × 32',width:260,height:378},{name:'大一寸',mm:'33 × 48',width:390,height:567},{name:'小二寸',mm:'35 × 45',width:413,height:531},{name:'大二寸',mm:'35 × 53',width:413,height:626}]
export const plans=[{name:'1次卡',price:3,detail:'下载简历 1 次'},{name:'3天卡',price:8,detail:'3 天内不限次下载'},{name:'1月卡',price:12,detail:'30 天内不限次下载'},{name:'终身卡',price:19,detail:'永久不限次下载'}]
export const levels=['最小','较小','标准','较大','最大']
