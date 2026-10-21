<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppIcon from '../../components/AppIcon.vue'
import { state } from './store'
import { go, back } from './navigation'
const props=withDefaults(defineProps<{title?:string;tab?:'home'|'profile';wide?:boolean;beforeBack?:()=>boolean|Promise<boolean>}>(),{title:''})
async function leave(){if(!props.beforeBack||await props.beforeBack())back()}
const top=ref(24);const bar=ref(46)
onMounted(()=>{const info=uni.getSystemInfoSync();top.value=info.statusBarHeight||24
 // #ifdef MP-WEIXIN
 const capsule=uni.getMenuButtonBoundingClientRect();top.value=info.statusBarHeight||20;bar.value=(capsule.top-top.value)*2+capsule.height
 // #endif
})
</script>
<template>
 <view class="prototype theme-fern q-app" :class="{'reduced-motion':state.reduced}">
  <view class="q-chrome" :style="{paddingTop:top+'px'}">
   <!-- #ifdef H5 --><view class="sim-status"><text>9:41</text><text>••• ▰</text></view><!-- #endif -->
   <view class="q-navbar" :style="{height:bar+'px'}"><button v-if="!tab" role="button" class="q-nav-back" aria-label="返回" @click="leave"><AppIcon name="back" :size="23" /></button><view v-else class="brand-lockup"><view class="brand-symbol"><view/><view/></view><text>轻简履</text></view><text v-if="!tab" class="q-nav-title">{{title}}</text>
    <!-- #ifdef H5 --><view class="sim-capsule"><text>•••</text><view/><text>◉</text></view><!-- #endif -->
   </view>
  </view>
  <view class="q-body" :class="{'q-body-wide':wide}"><slot/></view>
  <view v-if="$slots.footer" class="q-footer"><slot name="footer"/></view>
  <view v-if="tab" class="q-tabbar"><button role="button" :class="{active:tab==='home'}" @click="go('home')"><AppIcon name="home"/><text>首页</text></button><button role="button" :class="{active:tab==='profile'}" @click="go('profile')"><AppIcon name="user"/><text>我的</text></button></view>
  <slot name="overlay"/>
 </view>
</template>
