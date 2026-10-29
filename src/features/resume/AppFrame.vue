<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onResize } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import { state,storageStatus,reloadLocal } from './store'
import { go, back } from './navigation'
const props=withDefaults(defineProps<{title?:string;tab?:'home'|'profile';wide?:boolean;beforeBack?:()=>boolean|Promise<boolean>}>(),{title:''})
async function leave(){if(!props.beforeBack||await props.beforeBack())back()}
function retryStorage(){if(reloadLocal())go('home')}
const top=ref(24);const bar=ref(46);const capsuleSpace=ref('190rpx')
function measure(){const info=uni.getWindowInfo();top.value=info.statusBarHeight||0
 // #ifdef MP-WEIXIN
 const capsule=uni.getMenuButtonBoundingClientRect();if(capsule.height>0&&capsule.top>=top.value){bar.value=Math.max(44,(capsule.top-top.value)*2+capsule.height);capsuleSpace.value=Math.max(88,info.windowWidth-capsule.left+12)+'px'}
 // #endif
}
onMounted(measure)
onResize(measure)
</script>
<template>
 <view class="prototype theme-fern q-app" :class="{'reduced-motion':state.reduced}">
  <view class="q-chrome" :style="{paddingTop:top+'px'}">
   <!-- #ifdef H5 --><view class="sim-status"><text>9:41</text><text>••• ▰</text></view><!-- #endif -->
   <view class="q-navbar" :style="{height:bar+'px',paddingRight:capsuleSpace}"><button v-if="!tab" role="button" class="q-nav-back" aria-label="返回" @click="leave"><AppIcon name="back" :size="23" /></button><view v-else class="brand-lockup"><view class="brand-symbol"><view/><view/></view><text>轻简履</text></view><text v-if="!tab" class="q-nav-title" :style="{right:capsuleSpace}">{{title}}</text>
    <!-- #ifdef H5 --><view class="sim-capsule"><text>•••</text><view/><text>◉</text></view><!-- #endif -->
   </view>
  </view>
  <view v-if="storageStatus.blocked" class="q-storage-warning" role="alert"><text>{{storageStatus.error}} 下方为临时示例，暂不保存。</text><button role="button" class="q-text-button" @click="retryStorage">重试读取</button><button role="button" class="q-text-button" @click="go('settings')">前往设置</button></view>
  <view class="q-body" :class="{'q-body-wide':wide}"><slot/></view>
  <view v-if="$slots.footer" class="q-footer"><slot name="footer"/></view>
  <view v-if="tab" class="q-tabbar"><button role="button" :class="{active:tab==='home'}" @click="go('home')"><AppIcon name="home"/><text>首页</text></button><button role="button" :class="{active:tab==='profile'}" @click="go('profile')"><AppIcon name="user"/><text>我的</text></button></view>
  <slot name="overlay"/>
 </view>
</template>
