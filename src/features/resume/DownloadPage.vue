<script setup lang="ts">
import { computed,ref,onBeforeUnmount } from 'vue'
import { onHide,onShow } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import { currentResume,state,persist,message } from './store'
import { templates } from '../../data/prototype'
import { go } from './navigation'
const props=defineProps<{type?:string;selected?:string}>()
const stage=ref<'ready'|'loading'|'success'|'error'|'quota'>('ready');const progress=ref(0);const remaining=ref(24*3600);const details=ref(false)
const name=computed(()=>props.type==='word'?(templates.find(t=>t.id===props.selected)?.name||'示例')+' Word 模板':currentResume.value.title)
let timer:ReturnType<typeof setInterval>|undefined;let countdown:ReturnType<typeof setInterval>|undefined
const countdownText=computed(()=>`${String(Math.floor(remaining.value/3600)).padStart(2,'0')}小时${String(Math.floor(remaining.value%3600/60)).padStart(2,'0')}分钟${String(remaining.value%60).padStart(2,'0')}秒`)
function start(){if(stage.value==='loading')return;if(state.simulation==='quota'&&state.member===null){stage.value='quota';return}stage.value='loading';progress.value=0;timer=setInterval(()=>{progress.value=Math.min(100,progress.value+20);if(progress.value===100){clearInterval(timer);if(state.simulation==='error'){stage.value='error';return}stage.value='success';state.exports.unshift({id:'export-'+Date.now(),title:name.value,time:Date.now(),type:props.type==='word'?'WORD 模板':'简历文档'});persist()}},140)}
function cancel(){clearInterval(timer);stage.value='ready';progress.value=0;message('已取消，不会生成下载记录')}
function more(){details.value=!details.value;if(details.value&&!countdown)countdown=setInterval(()=>{if(remaining.value>0)remaining.value--},1000)}
onBeforeUnmount(()=>{clearInterval(timer);clearInterval(countdown)})
onHide(()=>{clearInterval(timer);clearInterval(countdown);countdown=undefined;if(stage.value==='loading'){stage.value='ready';progress.value=0}})
onShow(()=>{if(details.value&&!countdown)countdown=setInterval(()=>{if(remaining.value>0)remaining.value--},1000)})
</script>
<template><AppFrame :title="type==='word'?'下载模板':'下载文档'" :before-back="()=>{if(stage==='loading')cancel();return true}"><scroll-view scroll-y class="q-scroll"><view class="q-page"><view class="q-download-art" :class="stage"><AppIcon :name="stage==='success'?'check':stage==='error'?'help':stage==='quota'?'clock':'download'" :size="42"/></view><text class="q-title q-center">{{stage==='success'?'模拟下载流程已完成':stage==='error'?'这次没有准备成功':stage==='quota'?'今日试用机会已用完':stage==='loading'?'正在准备你的文档':'准备好，再向前一步。'}}</text><text class="q-description q-center">{{name}}</text><view class="q-note"><AppIcon name="help" :size="20"/><text>前端演示：不请求文件服务，不会生成真实 {{type==='word'?'.docx':'简历'}} 文件。完成状态只用于测试交互。</text></view>
 <view v-if="stage==='loading'" class="q-card q-content-card"><view class="q-between"><text>正在模拟生成…</text><text>{{progress}}%</text></view><view class="q-progress"><view :style="{width:progress+'%'}"/></view><button role="button" class="q-text-button q-center" @click="cancel">取消本次操作</button></view>
 <view v-else-if="stage==='quota'" class="q-card q-content-card"><text>体验说明：模拟每 24 小时一次免费下载。当前为手动选择的额度场景，不对应真实账户额度。</text><button role="button" class="q-text-button" @click="more">{{details?'收起说明':'了解更多'}}</button><view v-if="details" class="q-countdown"><text class="q-small">模拟距下次免费还有</text><text>{{countdownText}}</text></view><button role="button" class="q-outline-button" @click="go('membership')">了解无限下载（模拟）</button></view>
 <view v-else-if="stage==='error'" class="q-error-summary"><text>模拟服务错误，简历内容已保留。可以重试或返回继续编辑。</text><button role="button" class="q-text-button" @click="go('workspace')">继续编辑</button></view>
 <view v-else-if="stage==='success'" class="q-card q-content-card"><text class="q-row-title">已记录一次模拟完成</text><text>真实版本将在生成文件后支持预览、保存或分享。当前没有文件需要打开。</text><button role="button" class="q-text-button" @click="go('downloads')">查看模拟记录 →</button><button role="button" class="q-text-button" @click="go('preview')">返回简历预览</button></view>
 <view v-else class="q-card q-content-card"><text class="q-row-title">下载前的小提醒</text><view class="q-feature-line"><AppIcon name="check" :size="17"/><text>检查姓名与联系方式是否正确</text></view><view class="q-feature-line"><AppIcon name="check" :size="17"/><text>预览全文，确认模块与顺序</text></view><view class="q-feature-line"><AppIcon name="check" :size="17"/><text>本轮不付费、不扣减实际额度</text></view></view>
 </view></scroll-view><template #footer><ActionButton :label="stage==='loading'?'模拟准备中':stage==='success'?'回到首页':stage==='quota'?'查看会员体验':stage==='error'?'重试模拟下载':'开始模拟下载'" :loading="stage==='loading'" @click="stage==='success'?go('home'):stage==='quota'?go('membership'):start()"/></template></AppFrame></template>
