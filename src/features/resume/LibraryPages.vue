<script setup lang="ts">
import { computed,ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import ResumePaper from '../../components/ResumePaper.vue'
import { templates,filters } from '../../data/prototype'
import { currentResume,updateResume,message,state,persist } from './store'
import { plans } from './schema'
import { go,back } from './navigation'
const props=defineProps<{mode:'templates'|'word'|'word-detail'|'membership';from?:string;selected?:string}>()
const filter=ref('全部');const search=ref('');const selected=ref(props.selected||currentResume.value.layout.templateId);const plan=ref(0);const agreeing=ref(false);const busy=ref(false);const checkout=ref(false);const result=ref('')
const visible=computed(()=>templates.filter(t=>(filter.value==='全部'||t.category===filter.value)&&t.name.includes(search.value)))
const detail=computed(()=>templates.find(t=>t.id===props.selected)||templates[0])
function use(){if(updateResume(r=>{r.layout.templateId=selected.value})){message('已应用样式');if(props.from==='preview')back();else go('workspace')}}
function order(){if(!agreeing.value){message('请先阅读并勾选体验说明');return}checkout.value=true;result.value=''}
let paymentTimer:ReturnType<typeof setTimeout>|undefined
onHide(()=>{clearTimeout(paymentTimer);busy.value=false;checkout.value=false})
function simulatePay(){if(busy.value)return;busy.value=true;paymentTimer=setTimeout(()=>{busy.value=false;if(state.simulation==='error'){result.value='error';return}state.member=plan.value;persist();result.value='success'},600)}
</script>
<template>
 <AppFrame :title="mode==='templates'?'简历样式':mode==='word'?'WORD 模板':mode==='membership'?'会员权益':'模板详情'">
  <scroll-view scroll-y class="q-scroll"><view class="q-page">
   <template v-if="mode==='templates'||mode==='word'">
    <text class="eyebrow">{{mode==='word'?'EDIT ON YOUR DESKTOP.':'找到属于你的表达'}}</text><text class="q-title">{{mode==='word'?'好内容，换个方式写。':'同样的经历，更多可能。'}}</text><text class="q-description">{{mode==='word'?'Word 模板适合在电脑上编辑，手机上可先看看版式。':'选择清晰、得体的样式，让内容成为主角。'}}</text>
    <view v-if="mode==='word'" class="q-note"><AppIcon name="word" :size="21"/><text>本轮展示 6 款示例版式，下载为模拟流程，不会生成真实 Word 文件。</text></view>
    <view class="q-search"><AppIcon name="search" :size="19"/><input v-model="search" placeholder="搜索模板名称" aria-label="搜索模板"/><button v-if="search" role="button" class="q-clear" aria-label="清空搜索" @click="search=''"><AppIcon name="close" :size="16"/></button></view>
    <view class="q-filter-row"><button role="button" v-for="item in filters" :key="item" :class="{active:filter===item}" @click="filter=item">{{item}}</button></view>
    <view v-if="!visible.length" class="q-empty q-card"><AppIcon name="search" :size="34"/><text class="q-row-title">暂时没有匹配的样式</text><text class="q-small">换个名称，或看看全部模板。</text><button role="button" class="q-text-button" @click="search='';filter='全部'">查看全部</button></view>
    <view class="q-template-grid"><button role="button" v-for="item in visible" :key="item.id" class="q-template-card" :class="{active:mode==='templates'&&selected===item.id}" :aria-label="item.name+(mode==='templates'&&selected===item.id?'，已选中':'')" @click="mode==='word'?go('word-detail',{selected:item.id}):(selected=item.id)"><view class="q-template-art"><ResumePaper :template-id="item.id"/><view v-if="mode==='templates'&&selected===item.id" class="q-template-check"><AppIcon name="check" :size="15"/> 已选</view></view><text class="q-row-title">{{item.name}}</text><text class="q-small">{{item.label}}</text></button></view><text class="q-endnote">所有样式都使用同一份示例内容展示。</text>
   </template>
   <template v-else-if="mode==='word-detail'"><view class="q-between"><view><text class="eyebrow">WORD COLLECTION</text><text class="q-title">{{detail.name}}</text></view><text class="q-badge">示例模板</text></view><text class="q-description">{{detail.description}}。适合 {{detail.category}} 风格的简历。</text><view class="q-word-preview"><ResumePaper :template-id="detail.id" :large="true"/></view><view class="q-card q-content-card"><text class="q-row-title">使用建议</text><text>下载后在电脑 Word 中编辑，替换示例姓名、经历与联系方式。手机预览可能与电脑排版略有差异。</text><text class="q-small">当前为前端下载演示，真实 .docx 素材与下载服务待接入。</text></view></template>
   <template v-else>
    <view class="q-member-hero"><view class="pill"><AppIcon name="sparkle" :size="15"/>让每一份准备更从容</view><text class="q-title">把更多可能，{{'\n'}}留给下一程。</text><text class="q-description">选择适合你的下载权益，认真打磨每一次投递。</text></view>
    <view class="q-note"><AppIcon name="help" :size="20"/><text>前端体验：以下为参考套餐与示例价格，仅模拟选择和开通，不扣款、不产生真实订单。</text></view>
    <view class="q-plan-grid"><button role="button" v-for="(item,index) in plans" :key="item.name" :class="{active:plan===index}" @click="plan=index"><view class="q-between"><text>{{item.name}}</text><AppIcon v-if="plan===index" name="check" :size="18"/></view><text class="q-plan-price"><text>¥</text>{{item.price}}</text><text class="q-small">{{item.detail}}</text></button></view>
    <view class="q-card q-content-card"><text class="q-row-title">把精力留给内容</text><view v-for="text in ['多款简历样式随心切换','支持封面与文档主题设置','按所选套餐享受下载权益','一次选择，不自动续费']" :key="text" class="q-feature-line"><AppIcon name="check" :size="17"/><text>{{text}}</text></view></view>
    <button role="button" class="q-agreement" @click="agreeing=!agreeing"><view class="q-checkbox" :class="{active:agreeing}"><AppIcon v-if="agreeing" name="check" :size="14"/></view><text>我已了解这是模拟开通，不会实际支付。</text></button>
   </template>
  </view></scroll-view>
  <template #footer><template v-if="mode==='templates'"><view class="q-selection"><text>已选样式</text><text>{{templates.find(t=>t.id===selected)?.name}}</text></view><ActionButton label="用这个样式" arrow @click="use"/></template><ActionButton v-else-if="mode==='word-detail'" label="下载模板" @click="go('download',{type:'word',selected:detail.id})"/><ActionButton v-else-if="mode==='membership'" label="模拟开通会员" @click="order"/><view v-else class="q-footer-tip">选一个喜欢的版式，看看详细内容。</view></template>
  <template #overlay><wd-popup :z-index="100" v-model="checkout" position="bottom" custom-class="q-popup" :close-on-click-modal="!busy" :safe-area-inset-bottom="true"><view class="q-sheet"><view class="q-sheet-handle"/><view class="q-between"><text class="q-sheet-title">{{result==='success'?'模拟开通完成':result==='error'?'模拟开通未完成':'确认体验套餐'}}</text><button role="button" class="q-icon-button" aria-label="关闭模拟开通" :disabled="busy" @click="checkout=false"><AppIcon name="close"/></button></view><view v-if="result==='success'" class="q-success-illustration"><AppIcon name="check" :size="36"/></view><text class="q-description">{{result==='success'?plans[plan].name+'已在本机模拟生效，没有产生付款。':result==='error'?'模拟服务异常，没有扣款。你可以再次尝试或取消。':plans[plan].name+' · ¥'+plans[plan].price+'（仅展示，不会扣款）'}}</text><ActionButton :label="busy?'模拟处理中':result==='success'?'完成':'确认模拟开通'" :loading="busy" @click="result==='success'?(checkout=false):simulatePay()"/><button v-if="result!=='success'" role="button" class="q-text-button q-center" :disabled="busy" @click="checkout=false">取消</button></view></wd-popup></template>
 </AppFrame>
</template>
