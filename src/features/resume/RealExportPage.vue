<script setup lang="ts">
import { computed,ref,watch,onBeforeUnmount } from 'vue'
import { onHide,onShow } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import ActionButton from '../../components/ActionButton.vue'
import AppIcon from '../../components/AppIcon.vue'
import { currentResume,clone } from './store'
import { makeResume,type Resume } from './schema'
import { templates } from '../../data/prototype'
import { account,snapshotForServer,createExport,getExport,cancelExport,downloadExport,sameSession,type ExportRecord } from './backend'
import { go } from './navigation'
const props=defineProps<{type?:string;selected?:string}>()
const emit=defineEmits<{simulate:[]}>()
const format=ref<'pdf'|'docx'>(props.type==='word'?'docx':'pdf')
const busy=ref(false),opening=ref(false),error=ref(''),feedback=ref(''),record=ref<ExportRecord|null>(null)
const title=computed(()=>record.value?.title||(props.type==='word'?(templates.find(t=>t.id===props.selected)?.name||'示例')+' · 可编辑示例':currentResume.value.title))
const stateLabel=computed(()=>({queued:'已进入生成队列',running:'正在排版你的文档',complete:'文档已生成',failed:'这次没有生成成功',cancelled:'生成已取消'}[record.value?.state||'queued']))
let timer:ReturnType<typeof setTimeout>|undefined,version=0,cancelRequested=false,visible=true
let sourceId=currentResume.value.id
let sourceUser=account.session?.user.id
let attempt:{key:string;resume:Resume;format:'pdf'|'docx';token:string}|undefined
const waiting=computed(()=>busy.value||record.value?.state==='queued'||record.value?.state==='running')
function stop(){visible=false;version++;clearTimeout(timer);timer=undefined;busy.value=false;opening.value=false}
onHide(stop);onBeforeUnmount(stop)
function sourceChanged(){if(sourceUser!==account.session?.user.id||(props.type!=='word'&&sourceId!==currentResume.value.id)){clearTimeout(timer);version++;sourceId=currentResume.value.id;sourceUser=account.session?.user.id;record.value=null;attempt=undefined;busy.value=false;error.value='';feedback.value='账号或草稿已变化。此前生成的文件可登录原账号，从下载记录查看。'}}
watch(()=>[currentResume.value.id,account.session?.user.id],sourceChanged)
onShow(()=>{visible=true;sourceChanged();if(record.value&&['queued','running'].includes(record.value.state))void poll(record.value.id,version,account.session?.token)})
async function poll(id:string,generation:number,token?:string){
 try{
  const result=await getExport(id);sameSession(token)
  if(!visible||generation!==version)return
  record.value=result
  if(result.state==='queued'||result.state==='running')timer=setTimeout(()=>void poll(id,generation,token),1500)
  else{busy.value=false;if(result.state==='failed')error.value=result.error||'生成未完成，请重新生成'}
 }catch(e){if(visible&&generation===version){busy.value=false;error.value=(e as Error).message;feedback.value='停止自动刷新。已发出的任务可能仍在生成，可从下载记录查看。'}}
}
async function start(){
 if(waiting.value||opening.value)return
 const token=account.session?.token;if(!token){go('cloud');return}
 const generation=++version;busy.value=true;error.value='';feedback.value='';cancelRequested=false;record.value=null
 try{
  if(!attempt){
   let resume=clone(currentResume.value)
   if(props.type==='word'){resume=makeResume(true);resume.title=title.value;const template=templates.find(t=>t.id===props.selected)||templates[0];resume.layout.templateId=template.id;resume.layout.color=template.color}
   const snapshot=await snapshotForServer(resume,token)
   if(generation!==version||!visible)return
   attempt={key:'export-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),resume:snapshot,format:format.value,token}
  }
  sameSession(attempt.token)
  const result=await createExport(attempt.resume,attempt.format,attempt.key)
  if(generation!==version||!visible)return
  record.value=result
  if(cancelRequested){await cancel();return}
  await poll(result.id,generation,token)
 }catch(e){if(generation===version&&visible){error.value=(e as Error).message;feedback.value=attempt?'重试会查询同一请求，不重复创建文件。也可从下载记录确认结果。':'原简历保留，请检查照片或网络后重试。';busy.value=false}}
}
async function cancel(){
 if(!record.value){cancelRequested=true;feedback.value='正在取消；等待已发出请求返回后确认结果。';return}
 const id=record.value.id,generation=++version;clearTimeout(timer)
 try{const result=await cancelExport(id);if(visible&&generation===version){record.value=result;busy.value=false;feedback.value='已取消，不会发布本次生成文件。'}}
 catch(e){if(visible&&generation===version){error.value=(e as Error).message;busy.value=false;void poll(id,generation,account.session?.token)}}
}
function fresh(){if(waiting.value)return;attempt=undefined;record.value=null;sourceId=currentResume.value.id;error.value='';feedback.value='';version++}
function choose(value:'pdf'|'docx'){if(waiting.value||opening.value)return;fresh();format.value=value}
async function open(){if(!record.value||opening.value||record.value.state!=='complete')return;opening.value=true;error.value='';const generation=version;try{await downloadExport(record.value,()=>visible&&generation===version);if(visible&&generation===version)feedback.value='已发起文件下载／打开。文件保留在下载记录中，可再次下载。'}catch(e){if(visible&&generation===version)error.value=(e as Error).message}finally{if(visible&&generation===version)opening.value=false}}
</script>
<template>
 <AppFrame :title="type==='word'?'生成 Word 示例':'导出简历'">
  <scroll-view scroll-y class="q-scroll"><view class="q-page q-export-page">
   <text class="eyebrow">READY FOR THE NEXT CHAPTER.</text><text class="q-title">把认真，带到下一站。</text><text class="q-description">{{title}}</text>
   <view class="q-note"><text>{{type==='word'?'生成含虚构人物与经历的可编辑 DOCX 示例，不使用当前简历。':'将点击生成时已保存的简历和照片发送至当前配置的后端，生成真实文件。'}}{{account.session?.user.provider==='development'?'当前连接本机开发测试账号。':''}}未接入收费或正式会员额度。</text></view>
   <view v-if="error" class="q-error-summary" role="alert"><text>{{error}}</text></view>
   <view v-if="feedback" class="q-note" role="status"><text>{{feedback}}</text></view>
   <view v-if="!account.session" class="q-card q-content-card"><text class="q-row-title">先连接账号，妥善保存文件。</text><text>日常编辑仍保存在本机。登录后主动生成，文件仅当前账号可访问。</text><ActionButton label="去连接账号" @click="go('cloud')"/></view>
   <template v-else>
    <view v-if="!record" class="q-card q-content-card"><text class="q-row-title">选择文件格式</text><view class="q-export-formats"><button v-for="item in [{id:'pdf',name:'PDF',detail:'适合投递 · 固定版式'},{id:'docx',name:'Word',detail:'方便继续编辑 · DOCX'}]" v-show="type!=='word'||item.id==='docx'" :key="item.id" :disabled="waiting" :aria-pressed="format===item.id" :class="{selected:format===item.id}" @click="choose(item.id as 'pdf'|'docx')"><text>{{item.name}}</text><text class="q-small">{{item.detail}}</text></button></view><text class="q-small">PDF 使用 A4 实际排版；Word 的分页随查看软件和字体变化。长内容将自然续页。</text></view>
    <view v-else class="q-card q-content-card"><view class="q-between"><text class="q-row-title">{{stateLabel}}</text><AppIcon :name="record.state==='complete'?'check':record.state==='failed'?'help':'file'" :size="24"/></view><text>{{record.title}} · {{record.format.toUpperCase()}}</text><text v-if="record.state==='complete'" class="q-small">{{Math.ceil(record.size/1024)}} KB · 已保存到当前账号</text><text v-if="waiting" class="q-small">正在处理真实文件，请稍候。离开页面后任务继续，可从下载记录查看。</text><ActionButton v-if="record.state==='complete'" label="下载／打开文件" :loading="opening" @click="open"/><button v-if="!waiting" class="q-outline-button" :disabled="opening" @click="fresh">再生成一份</button></view>
    <button v-if="waiting" class="q-outline-button" @click="cancel">取消本次生成</button>
    <ActionButton v-if="!waiting&&!record" id="real-export-start" :label="attempt?'重试同一次生成':'生成 '+format.toUpperCase()+' 文件'" :loading="busy" @click="start"/>
    <text v-if="busy&&!record" class="q-small" role="status">正在准备内容和照片…</text>
    <button class="q-text-button" :disabled="opening" @click="go('downloads')">查看真实下载记录 →</button>
   </template>
   <view class="q-card q-content-card"><text class="q-row-title">生成前，再看一眼。</text><text class="q-small">确认联系方式、模块顺序和照片。文件按本次快照生成；继续编辑不会改变已生成的文件。服务端保留最多 50 条记录，支持重新下载和删除。</text><button class="q-text-button" @click="go('preview')">检查简历预览 →</button></view>
   <button class="q-text-button" :disabled="waiting||opening" @click="emit('simulate')">进入原有模拟流程（不生成文件）</button>
  </view></scroll-view>
 </AppFrame>
</template>
<style scoped>
.q-export-page .q-content-card{gap:24rpx}.q-export-formats{display:flex;gap:16rpx}.q-export-formats button{flex:1;display:flex;flex-direction:column;gap:12rpx;align-items:flex-start;background:var(--bg);border:1px solid var(--line);border-radius:20rpx;padding:24rpx;text-align:left;line-height:1.6;font-size:30rpx;min-height:100px}.q-export-formats button.selected{background:var(--soft);border-color:var(--accent)}.q-export-page button[disabled]{opacity:.55}
</style>
