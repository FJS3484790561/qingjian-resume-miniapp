<script setup lang="ts">
import { computed,ref,onBeforeUnmount,watch } from 'vue'
import { onHide,onShow } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import { definitions,plain,escapeHtml,type ModuleId } from './schema'
import { currentResume,state,saveModule,clone } from './store'
import { go,back } from './navigation'
import { useUnsavedGuard } from './useUnsavedGuard'
import { account,getAiService,getAiUsage,createAiJob,getAiJob,cancelAiJob,sameSession,type AiService,type AiUsage } from './backend'
const targets=computed(()=>definitions.flatMap(d=>currentResume.value.modules[d.id].entries.filter(e=>plain(e.content||'')).map(e=>({module:d.id,id:e.id,name:currentResume.value.modules[d.id].name+' · '+(e.name||'正文'),content:e.content}))))
const selected=ref(0);const busy=ref(false);const result=ref('');const error=ref('');const applied=ref(false);const previous=ref('');const feedback=ref('');let active=true;let generation=0;let timer:ReturnType<typeof setTimeout>|undefined
const mode=ref<'real'|'demo'>('real'),consent=ref(false),service=ref<AiService|null>(null),usage=ref<AiUsage|null>(null),checking=ref(false)
const realState=ref(''),jobId=ref('');let requestKey='',requestSnapshot='',jobToken=''
let source:{resumeId:string;module:ModuleId;id:string;content:string;accountToken?:string}|undefined;let appliedContent=''
const target=computed(()=>targets.value[selected.value])
const dirty=()=>!!result.value&&!applied.value
const unloadGuard=useUnsavedGuard(dirty,'整理结果尚未应用，返回会放弃当前结果，原文仍保留。')
let confirming=false
async function confirmDiscard(title:string,content:string,confirmText='保留原文'){if(!dirty())return true;if(confirming)return false;confirming=true;return new Promise<boolean>(resolve=>uni.showModal({title,content,confirmText,cancelText:'继续编辑',success:r=>resolve(r.confirm&&active),fail:()=>resolve(false),complete:()=>{confirming=false}}))}
async function beforeBack(){const leave=await confirmDiscard('保留原文并离开？','当前整理结果尚未应用。可以继续编辑，或放弃结果，保留简历原文。');if(leave){cancelPending();unloadGuard.clear()}return leave}
async function requestGenerate(){if(busy.value||applied.value)return;if(await confirmDiscard('重新整理这段正文？','重新整理会替换尚未应用的结果，包括你的手动修改。原简历正文仍保留。','重新整理')){if(mode.value==='demo')generate();else void generateReal()}}
async function changeTarget(event:any){const index=Number(event.detail.value);if(index===selected.value||!targets.value[index]||busy.value||applied.value)return;if(await confirmDiscard('切换整理内容？','切换会放弃尚未应用的结果，包括你的手动修改。原简历正文仍保留。','切换内容')){cancelPending();selected.value=index;reset();consent.value=false}}
defineExpose({isDirty:dirty,requestBack:async()=>{if(await beforeBack())back()}})
async function changeMode(next:'real'|'demo') {if(mode.value===next||busy.value||applied.value)return;if(await confirmDiscard('切换优化方式？','切换会放弃尚未应用的结果，原文保留。','切换')){cancelPending();reset();mode.value=next;consent.value=false}}
async function refreshService(){if(checking.value)return;checking.value=true;const token=account.session?.token;try{service.value=await getAiService();if(token){const value=await getAiUsage();if(account.session?.token===token)usage.value=value}}catch{service.value=null;feedback.value='暂时无法查询 AI 服务，请稍后刷新。'}finally{checking.value=false}}
function cancelPending(){const id=jobId.value,token=jobToken;generation++;clearTimeout(timer);busy.value=false;realState.value='';jobId.value='';jobToken='';if(id&&token&&account.session?.token===token)void cancelAiJob(id).catch(()=>{});requestKey='';requestSnapshot=''}
function cancelGeneration(){cancelPending();feedback.value=mode.value==='demo'?'本机演示已取消，原文未变。':'已停止等待并请求取消，原文未变。已发送给服务商的请求可能已经计费。'}
async function generateReal(){
 if(!target.value||busy.value||applied.value)return
 error.value=''
 if(!account.session){error.value='请先在账号与简历备份中登录，原文未发送。';return}
 if(!service.value?.enabled){error.value='AI 服务尚未配置或暂不可用，原文未发送。可刷新服务或切换本机演示。';return}
 if(!consent.value){error.value='请先同意将当前选中的正文发送至 '+service.value.provider+'。';return}
 const chosen={...target.value},sessionToken=account.session.token
 const snapshot=JSON.stringify([currentResume.value.id,chosen.id,chosen.content,sessionToken])
 // A lost POST response is retried with the same key. Explicit cancellation/terminal failure creates a new request.
 if(snapshot!==requestSnapshot||!requestKey){requestSnapshot=snapshot;requestKey='ai-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
 const key=requestKey
 reset();busy.value=true;realState.value='正在提交';jobToken=sessionToken
 source={resumeId:currentResume.value.id,module:chosen.module,id:chosen.id,content:chosen.content,accountToken:sessionToken};previous.value=chosen.content
 const version=++generation
 const valid=()=>active&&version===generation&&currentResume.value.id===source?.resumeId&&account.session?.token===sessionToken
 try{
  const job=await createAiJob(plain(chosen.content),currentResume.value.modules[chosen.module].name,key,service.value)
  if(!valid()){if(account.session?.token===sessionToken)void cancelAiJob(job.id).catch(()=>{});return}
  sameSession(sessionToken);jobId.value=job.id
  const poll=async()=>{
   if(!valid())return
   try{
    const value=await getAiJob(job.id);if(!valid())return
    realState.value=value.state==='queued'?'正在排队':'AI 正在优化'
    if(value.state==='queued'||value.state==='running'){timer=setTimeout(()=>void poll(),900);return}
    busy.value=false;realState.value='';requestKey='';requestSnapshot='';jobId.value='';jobToken=''
    if(value.state==='complete'&&value.result&&!value.expired){result.value=value.result;feedback.value='AI 返回了建议，请逐项核对事实，确认后应用。'}
    else error.value=value.expired?'结果已过期，请重新优化。':value.error||'优化已取消，原文保留。'
    void refreshService()
   }catch(e){if(valid()){busy.value=false;error.value=String((e as Error).message||'查询失败，请重试获取结果，原文保留。')}}
  }
  void poll()
 }catch(e){if(valid()){busy.value=false;error.value=String((e as Error).message||'优化未完成，原文保留。')}}
}
function reset(){generation++;clearTimeout(timer);busy.value=false;result.value='';error.value='';applied.value=false;feedback.value='';source=undefined;previous.value=''}
function generate(){if(!target.value||busy.value||applied.value)return;const chosen={...target.value};reset();busy.value=true;const token=++generation;source={resumeId:currentResume.value.id,module:chosen.module,id:chosen.id,content:chosen.content};previous.value=chosen.content;const text=plain(chosen.content);const scenario=state.simulation;timer=setTimeout(()=>{if(!active||token!==generation)return;busy.value=false;if(scenario==='error'){error.value='模拟服务暂时不可用，原文已保留。可重试或在测试台切换场景。';return}const output=text.split(/[。\n]/).filter(s=>s.trim()).map(s=>'• '+s.trim().replace(/^[•\s]+/,'')+'。').join('\n');if(output.length>10000){error.value='整理后超过 10000 字，未覆盖原文。请先缩短原文再试。';return}result.value=output;feedback.value='已在本机整理，请检查后应用。'},650)}
function sourceEntry(expected:string){if(!source||source.resumeId!==currentResume.value.id){error.value='当前草稿已变化，请重新整理，原文未变。';return}if(source.accountToken&&source.accountToken!==account.session?.token){error.value='账号已变化，请重新优化，原文未变。';return}const entry=currentResume.value.modules[source.module].entries.find(e=>e.id===source!.id);if(!entry||entry.content!==expected){error.value='这条正文已被修改或删除，为避免覆盖，请重新进入并整理。';return}return clone(entry)}
function apply(){if(busy.value||applied.value)return;error.value='';if(!result.value.trim()||result.value.length>10000){error.value='整理结果须为 1—10000 字，请修改后再应用。';return}const entry=sourceEntry(previous.value);if(!entry||!source)return;entry.content='<p>'+escapeHtml(result.value).replace(/\n/g,'</p><p>')+'</p>';if(saveModule(source.module,entry)){appliedContent=entry.content;applied.value=true;feedback.value=(mode.value==='demo'?'示例改写':'AI 建议')+'已应用到原模块，可在本页撤销。';unloadGuard.clear()}else error.value='本机保存失败，原文未变，整理结果仍在。请重试应用。'}
function undo(){if(!applied.value)return;error.value='';const entry=sourceEntry(appliedContent);if(!entry||!source)return;entry.content=previous.value;if(saveModule(source.module,entry)){reset();feedback.value='已恢复原文。'}else error.value='本机保存失败，撤销尚未完成。已应用内容仍在，可以重试。'}
function stop(){active=false;if(busy.value)feedback.value='整理已中断，原文未变，可以重新体验。';cancelPending()}
watch(()=>account.session?.token,()=>{cancelPending();reset();consent.value=false;usage.value=null;feedback.value='账号已变化，优化结果已清除，原文保留。'})
watch(()=>currentResume.value.id,()=>{if(mode.value==='real'){cancelPending();reset();consent.value=false;feedback.value='草稿已变化，请重新选择正文。'}})
watch(()=>service.value?.provider+'|'+service.value?.model,()=>{consent.value=false})
onBeforeUnmount(stop)
onHide(stop)
onShow(()=>{active=true;void refreshService()})
</script>
<template>
 <AppFrame title="智能优化" :before-back="beforeBack">
  <scroll-view scroll-y class="q-scroll"><view class="q-page">
   <view class="pill"><AppIcon name="sparkle" :size="16"/>让内容更清楚一点</view>
   <text class="q-title">你的积累，{{'\n'}}值得更好的表达。</text>
   <view class="q-inline-actions q-ai-modes">
    <button id="ai-real-mode" role="button" :aria-pressed="mode==='real'" :class="mode==='real'?'q-primary-button':'q-outline-button'" :disabled="busy||applied" @click="changeMode('real')">AI 优化</button>
    <button id="ai-demo-mode" role="button" :aria-pressed="mode==='demo'" :class="mode==='demo'?'q-primary-button':'q-outline-button'" :disabled="busy||applied" @click="changeMode('demo')">本机演示</button>
   </view>
   <view v-if="mode==='demo'" class="q-note"><AppIcon name="help" :size="20"/><text>本机交互演示：仅按原文分句整理，没有调用 AI，也不会发送内容。</text></view>
   <view v-else class="q-card q-content-card">
    <view class="q-between"><text class="q-row-title">{{service?.enabled?'AI 服务已配置':'AI 服务待配置'}}</text><button role="button" class="q-text-button" :disabled="busy||checking" @click="refreshService">{{checking?'查询中':'刷新'}}</button></view>
    <text v-if="service?.enabled" class="q-small">{{service.provider}} · {{service.model}}</text>
    <text v-else class="q-small">配置服务商和模型后可使用；现在可以切换本机演示测试交互。</text>
    <text v-if="usage" class="q-field-hint">最近 24 小时已发起 {{usage.attempts}} 次，完成 {{usage.completed}} 次。</text>
    <button v-if="!account.session" role="button" class="q-text-button" @click="go('cloud')">先登录账号 →</button>
   </view>
   <view v-if="!targets.length" class="q-empty q-card"><AppIcon name="edit" :size="34"/><text class="q-row-title">还没有可整理的正文</text><text class="q-small">先添加项目、工作、自我评价等内容。</text><button role="button" class="q-text-button" @click="go('workspace')">返回填写 →</button></view>
   <template v-else>
    <view class="q-form-card q-content-card"><text class="q-row-title">选择要整理的内容</text><picker :range="targets.map(t=>t.name)" :value="selected" :disabled="busy||applied" @change="changeTarget"><view class="q-picker-value">{{target?.name}}<AppIcon name="down" :size="17"/></view></picker></view>
    <view class="q-card q-content-card"><text class="q-row-title">原文</text><rich-text :nodes="previous||target?.content||''"/></view>
    <checkbox-group v-if="mode==='real'" @change="consent=$event.detail.value.includes('send')"><label class="q-agreement"><checkbox value="send" :checked="consent" :disabled="busy||applied||!service?.enabled" color="#346c57"/><text>同意将选中的正文及模块名称发送至{{service?.provider||'待配置的 AI 服务商'}}用于润色。不会发送整份简历或照片；结果需自行核对事实。</text></label></checkbox-group>
    <view v-if="error" class="q-error-summary" role="alert"><text>{{error}}</text><button v-if="!result" role="button" class="q-text-button" @click="requestGenerate">重试整理</button><button v-if="mode==='demo'" role="button" class="q-text-button" @click="go('testing')">切换模拟场景</button></view>
    <view v-if="result" class="q-card q-content-card"><view class="q-between"><text class="q-row-title">整理后的表达</text><text class="q-badge">{{mode==='demo'?'本机示例':'AI 建议'}}</text></view><textarea v-model="result" :adjust-position="true" :cursor-spacing="32" class="q-ai-result" maxlength="10000" :disabled="applied" aria-label="编辑整理结果"/><text class="q-field-hint">请检查内容准确性后再应用，可以继续修改。</text><button v-if="applied" role="button" id="ai-undo" class="q-text-button" @click="undo">撤销应用，恢复原文</button><view v-else class="q-inline-actions"><button role="button" class="q-outline-button" @click="reset">保留原文</button><button role="button" id="ai-apply" class="q-primary-button" @click="apply">{{mode==='demo'?'应用示例改写':'应用 AI 建议'}}</button></view></view>
    <text v-if="feedback" class="q-field-hint" aria-live="polite">{{feedback}}</text>
    <view v-if="busy" class="q-content-card q-center" role="status"><text class="q-small">{{mode==='real'?realState:'正在整理'}}，原文不会被覆盖…</text><button role="button" class="q-text-button" @click="cancelGeneration">取消本次优化</button></view>
   </template>
  </view></scroll-view>
  <template v-if="targets.length" #footer><view class="q-footer-row"><view class="q-footer-primary"><ActionButton :label="busy?'正在整理':mode==='real'?(result?'重新 AI 优化':'开始 AI 优化'):(result?'重新演示整理':'体验整理效果')" :loading="busy" :disabled="applied||(mode==='real'&&(!service?.enabled||!account.session||!consent))" @click="requestGenerate"/></view></view></template>
 </AppFrame>
</template>
<style scoped>.q-ai-modes{margin:24rpx 0}</style>
