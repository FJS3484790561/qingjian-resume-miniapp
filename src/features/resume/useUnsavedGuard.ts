import { watch } from 'vue'
import { onShow,onHide,onUnload } from '@dcloudio/uni-app'

// onBackPress covers H5; WeChat has a separate native-back prompt API.
// WeChat does not intercept swipe-back or exiting the mini program here.
export function useUnsavedGuard(dirty:()=>boolean,text:string) {
 let active=true
 function clear() {
  // #ifdef MP-WEIXIN
  uni.disableAlertBeforeUnload?.({fail:()=>{}})
  // #endif
 }
 function sync() {
  // #ifdef MP-WEIXIN
  if(active&&dirty())uni.enableAlertBeforeUnload?.({message:text,fail:()=>{}})
  else clear()
  // #endif
 }
 watch(dirty,sync,{flush:'sync'})
 onShow(()=>{active=true;sync()})
 onHide(()=>{active=false;clear()})
 onUnload(clear)
 return {clear}
}
