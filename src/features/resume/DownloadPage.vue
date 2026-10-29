<script setup lang="ts">
import { computed,ref,onBeforeUnmount } from 'vue'
import { onHide,onShow } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import RealExportPage from './RealExportPage.vue'
import { currentResume,state,updateState,message } from './store'
import { templates } from '../../data/prototype'
import { go } from './navigation'
const props=defineProps<{type?:string;selected?:string}>()
const useSimulation=ref(false)
const stage=ref<'ready'|'loading'|'success'|'error'|'quota'>('ready');const progress=ref(0);const remaining=ref(24*3600);const details=ref(false);const error=ref('');const feedback=ref('')
const name=computed(()=>props.type==='word'?(templates.find(t=>t.id===props.selected)?.name||'示例')+' Word 模板':currentResume.value.title)
let timer:ReturnType<typeof setInterval>|undefined;let countdown:ReturnType<typeof setInterval>|undefined;let generation=0;let deadline=0
const countdownText=computed(()=>`${String(Math.floor(remaining.value/3600)).padStart(2,'0')}小时${String(Math.floor(remaining.value%3600/60)).padStart(2,'0')}分钟${String(remaining.value%60).padStart(2,'0')}秒`)
function start(){if(stage.value==='loading'||stage.value==='success')return;error.value='';feedback.value='';if(state.simulation==='quota'&&state.member===null){stage.value='quota';if(!deadline)deadline=Date.now()+24*3600*1000;tick();return}stage.value='loading';progress.value=0;const token=++generation;const scenario=state.simulation;const title=name.value;const type=props.type==='word'?'WORD 模板':'简历文档';timer=setInterval(()=>{if(token!==generation)return;progress.value=Math.min(100,progress.value+20);if(progress.value===100){clearInterval(timer);timer=undefined;if(scenario==='error'){error.value='模拟服务错误，未生成文件或新增记录。原简历内容已保留。';stage.value='error';return}const success=updateState(next=>{next.exports.unshift({id:'export-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),title,time:Date.now(),type})});stage.value=success?'success':'error';if(!success)error.value='本机记录保存失败，没有新增下载记录。原简历内容已保留，请重试。'}},140)}
function cancel(){generation++;clearInterval(timer);timer=undefined;stage.value='ready';progress.value=0;feedback.value='已取消，不会生成下载记录。'}
function tick(){remaining.value=Math.max(0,Math.ceil((deadline-Date.now())/1000))}
function countdownStart(){tick();if(!countdown)countdown=setInterval(tick,1000)}
function more(){details.value=!details.value;if(details.value)countdownStart();else{clearInterval(countdown);countdown=undefined}}
function stop(){generation++;clearInterval(timer);clearInterval(countdown);timer=undefined;countdown=undefined;if(stage.value==='loading'){stage.value='ready';progress.value=0;feedback.value='已中断本次模拟，没有新增下载记录。'}}
onBeforeUnmount(stop)
onHide(stop)
onShow(()=>{if(details.value)countdownStart()})
</script>
<template><RealExportPage v-if="!useSimulation" :type="type" :selected="selected" @simulate="useSimulation=true"/><AppFrame v-else :title="type==='word'?'下载模板':'下载文档'" :before-back="()=>{if(stage==='loading')cancel();return true}"><scroll-view scroll-y class="q-scroll"><view class="q-page"><view class="q-download-art" :class="stage"><AppIcon :name="stage==='success'?'check':stage==='error'?'help':stage==='quota'?'clock':'download'" :size="42"/></view><button class="q-text-button" @click="useSimulation=false">返回真实文件导出</button><text class="q-title q-center">{{stage==='success'?'模拟下载流程已完成':stage==='error'?'这次没有准备成功':stage==='quota'?'今日试用机会已用完':stage==='loading'?'正在准备你的文档':'准备好，再向前一步。'}}</text><text class="q-description q-center">{{name}}</text><view class="q-note"><AppIcon name="help" :size="20"/><text>前端演示：不请求文件服务，不会生成真实 {{type==='word'?'.docx':'简历'}} 文件。完成状态只用于测试交互。</text></view>
 <view v-if="stage==='loading'" class="q-card q-content-card"><view class="q-between"><text>正在模拟生成…</text><text>{{progress}}%</text></view><view class="q-progress"><view :style="{width:progress+'%'}"/></view><button role="button" class="q-text-button q-center" @click="cancel">取消本次操作</button></view>
 <view v-else-if="stage==='quota'" class="q-card q-content-card"><text>体验说明：模拟每 24 小时一次免费下载。当前为手动选择的额度场景，不对应真实账户额度。</text><button role="button" class="q-text-button" @click="more">{{details?'收起说明':'了解更多'}}</button><view v-if="details" class="q-countdown"><text class="q-small">模拟距下次免费还有</text><text>{{countdownText}}</text></view><button role="button" class="q-outline-button" @click="go('membership')">了解无限下载（模拟）</button></view>
 <view v-else-if="stage==='error'" class="q-error-summary" role="alert"><text>{{error}}</text><button role="button" class="q-text-button" @click="type==='word'?go('word-detail',{selected:selected||''}):go('workspace')">{{type==='word'?'查看模板':'继续编辑'}}</button><button role="button" class="q-text-button" @click="go('testing')">切换模拟场景</button></view>
 <view v-else-if="stage==='success'" class="q-card q-content-card"><text class="q-row-title">已记录一次模拟完成</text><text>真实版本将在生成文件后支持预览、保存或分享。当前没有文件需要打开。</text><button role="button" class="q-text-button" @click="go('downloads')">查看模拟记录 →</button><button role="button" class="q-text-button" @click="type==='word'?go('word-detail',{selected:selected||''}):go('preview')">{{type==='word'?'返回模板详情':'返回简历预览'}}</button></view>
 <view v-else class="q-card q-content-card"><text class="q-row-title">下载前的小提醒</text><view class="q-feature-line"><AppIcon name="check" :size="17"/><text>检查姓名与联系方式是否正确</text></view><view class="q-feature-line"><AppIcon name="check" :size="17"/><text>预览全文，确认模块与顺序</text></view><view class="q-feature-line"><AppIcon name="check" :size="17"/><text>本轮不付费、不扣减实际额度</text></view></view>
 <text v-if="feedback" class="q-field-hint" aria-live="polite">{{feedback}}</text><button v-if="stage==='quota'" role="button" class="q-text-button" @click="go('testing')">去测试台切换场景</button>
 </view></scroll-view><template #footer><view class="q-footer-row"><view class="q-footer-primary"><ActionButton :label="stage==='loading'?'模拟准备中':stage==='success'?'回到首页':stage==='quota'?'查看会员体验':stage==='error'?'重试模拟下载':'开始模拟下载'" :loading="stage==='loading'" @click="stage==='success'?go('home'):stage==='quota'?go('membership'):start()"/></view></view></template></AppFrame></template>
