<script setup lang="ts">
import { computed,ref,getCurrentInstance,onBeforeUnmount } from 'vue'
import { onHide,onShow } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import { photoSpecs } from './schema'
import { go } from './navigation'
import { currentResume,updateResume } from './store'
import { photoSpec,photoPlacement,photoError } from './photo'
const props=defineProps<{mode:'photos'|'photo-editor';selected?:string}>()
const spec=computed(()=>photoSpec(props.selected));const image=ref('');const scale=ref(100);const offsetX=ref(0);const offsetY=ref(0);const background=ref('#ffffff');const generated=ref('');const busy=ref(false);const saving=ref(false);const applying=ref(false);const choosing=ref(false);const feedback=ref('');const error=ref('');const instance=getCurrentInstance()
let active=true;let disposed=false;let generation=0;const storedPath=ref('');const appliedPath=ref('');let watchdog:ReturnType<typeof setTimeout>|undefined
const locked=computed(()=>busy.value||saving.value||applying.value||choosing.value)
const portraitHead=computed(()=>({height:34*spec.value.width/spec.value.height+'%',top:38-17*spec.value.width/spec.value.height+'%'}))
const portraitBody=computed(()=>({height:88*spec.value.width/spec.value.height+'%',top:90-44*spec.value.width/spec.value.height+'%'}))
onShow(()=>{active=true})
function stop(){active=false;generation++;clearTimeout(watchdog);if(busy.value||applying.value)feedback.value='操作已中断，取景仍保留，可以重试。';busy.value=false;applying.value=false;saving.value=false}
onHide(stop)
onBeforeUnmount(()=>{stop();disposed=true})
function invalidate(){generation++;clearTimeout(watchdog);generated.value='';storedPath.value='';appliedPath.value='';busy.value=false;error.value='';feedback.value=''}
const backgrounds=[{color:'#ffffff',label:'白色'},{color:'#5389bc',label:'蓝色'},{color:'#ae4746',label:'红色'},{color:'#e4e9e3',label:'浅灰'}]
function choose(){if(locked.value)return;choosing.value=true;error.value='';uni.chooseImage({count:1,sizeType:['compressed'],sourceType:['album'],success:r=>{if(disposed)return;const path=r.tempFilePaths[0];if(!path){error.value=photoError(null,'choose');return}invalidate();image.value=path;scale.value=100;offsetX.value=0;offsetY.value=0;feedback.value='已选择本机照片，请调整取景后生成。'},fail:e=>{if(disposed)return;const text=photoError(e,'choose');if(/cancel/i.test(e.errMsg||''))feedback.value=text;else error.value=text},complete:()=>{choosing.value=false}})}
function sample(){if(locked.value)return;invalidate();image.value='';scale.value=100;offsetX.value=0;offsetY.value=0;feedback.value='已恢复示例头像，调整后可生成。'}
function generate(){if(locked.value)return;invalidate();busy.value=true;const token=++generation;const valid=()=>active&&!disposed&&token===generation;const width=spec.value.width,height=spec.value.height;const fail=(e:unknown,action:'read'|'generate'='generate')=>{if(!valid())return;clearTimeout(watchdog);generation++;busy.value=false;error.value=photoError(e,action)}
 watchdog=setTimeout(()=>fail(new Error('timeout')),15000)
 try {const ctx=uni.createCanvasContext('photo-export',instance?.proxy)
 ctx.setFillStyle(background.value);ctx.fillRect(0,0,width,height)
 const finish=()=>{if(!valid())return;ctx.draw(false,()=>{if(!valid())return;uni.canvasToTempFilePath({canvasId:'photo-export',width,height,destWidth:width,destHeight:height,fileType:'png',success:r=>{if(!valid())return;clearTimeout(watchdog);if(!r.tempFilePath){fail(null);return}generated.value=r.tempFilePath;busy.value=false;feedback.value=`已生成 ${width} × ${height} px 的本机 PNG，可以应用或保存。`},fail:e=>fail(e)},instance?.proxy)})}
 if(image.value){uni.getImageInfo({src:image.value,success:info=>{if(!valid())return;try{const p=photoPlacement(info.width,info.height,width,height,scale.value,offsetX.value,offsetY.value);ctx.drawImage(info.path||image.value,p.x,p.y,p.width,p.height);finish()}catch(e){fail(e,'read')}},fail:e=>fail(e,'read')})}
 else {ctx.save();ctx.translate(width/2+offsetX.value/100*width,height/2+offsetY.value/100*height);ctx.scale(scale.value/100,scale.value/100);ctx.setFillStyle('#d8bfa6');ctx.beginPath();ctx.arc(0,-height*.12,width*.17,0,Math.PI*2);ctx.fill();ctx.setFillStyle('#354d44');ctx.beginPath();ctx.arc(0,height*.4,width*.44,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-width*.44,height*.4,width*.88,height*.3);ctx.restore();finish()}
 }catch(e){fail(e)}
}
function useForResume(){if(!generated.value||locked.value||appliedPath.value===generated.value)return;applying.value=true;error.value='';const path=generated.value;const resumeId=currentResume.value.id;const originalPhoto=currentResume.value.basic.photo;const token=generation;const valid=()=>active&&!disposed&&token===generation;const apply=(saved:string)=>{if(!valid())return;applying.value=false;if(currentResume.value.id!==resumeId||currentResume.value.basic.photo!==originalPhoto){error.value='当前草稿或照片已变化，请重新确认后应用。';return}storedPath.value=saved;generated.value=saved;if(updateResume(resume=>{resume.basic.photo=saved})){appliedPath.value=saved;feedback.value='已添加到「'+currentResume.value.title+'」，可以前往简历查看。'}else error.value='图片已生成，但草稿保存失败，原有证件照未变。请重试应用。'}
 // #ifdef MP-WEIXIN
 if(storedPath.value){apply(storedPath.value);return}
 uni.saveFile({tempFilePath:path,success:r=>apply(r.savedFilePath),fail:e=>{if(valid()){applying.value=false;error.value=photoError(e,'apply')}}})
 // #endif
 // #ifdef H5
 apply(path)
 // #endif
}
function album(){if(locked.value||!generated.value)return;saving.value=true;error.value='';const path=generated.value;const token=generation;const valid=()=>!disposed&&token===generation
 // #ifdef MP-WEIXIN
 uni.saveImageToPhotosAlbum({filePath:path,success:()=>{if(valid())feedback.value='图片已保存到相册。'},fail:e=>{if(valid()){if(/cancel/i.test(e.errMsg||''))feedback.value=photoError(e,'album');else error.value=photoError(e,'album')}},complete:()=>{if(valid())saving.value=false}})
 // #endif
 // #ifdef H5
 saving.value=false;uni.previewImage({urls:[path]});feedback.value='浏览器仅预览，请手动保存。相册保存需在微信中测试。'
 // #endif
}
function adjust(which:'scale'|'x'|'y',event:any){if(locked.value)return;invalidate();if(which==='scale')scale.value=event.detail.value;else if(which==='x')offsetX.value=event.detail.value;else offsetY.value=event.detail.value}
function color(value:string){if(locked.value)return;invalidate();background.value=value}
</script>
<template><AppFrame :title="mode==='photos'?'证件照':'制作'+spec.name+'证件照'"><scroll-view scroll-y class="q-scroll"><view class="q-page">
 <template v-if="mode==='photos'"><text class="eyebrow">A GOOD FIRST IMPRESSION.</text><text class="q-title">一寸之间，{{'\n'}}也藏着认真。</text><text class="q-description">选择需要的规格，再调整照片的取景。</text><view class="q-photo-spec-grid"><button role="button" v-for="(item,i) in photoSpecs" :key="item.name" class="q-card" @click="go('photo-editor',{selected:String(i)})"><view class="q-spec-art"><view :style="{width:138*item.width/item.height+'rpx'}"><AppIcon name="user" :size="30"/></view></view><text class="q-row-title">{{item.name}}</text><text class="q-small">{{item.mm}} mm</text><text class="q-small">{{item.width}} × {{item.height}} px</text><AppIcon class="q-spec-arrow" name="arrow" :size="16"/></button></view><view class="q-note"><AppIcon name="help" :size="20"/><text>照片仅在本机处理。可用示例测试；当前不含人像抠图、换装或美颜。</text></view></template>
 <template v-else><view class="q-between"><view><text class="eyebrow">PHOTO STUDIO</text><text class="q-title q-title-small">刚刚好的第一印象。</text></view><text class="q-badge">{{spec.name}}</text></view><text class="q-description">{{spec.mm}} mm · {{spec.width}} × {{spec.height}} px</text>
 <view class="q-photo-stage-wrap"><view class="q-photo-stage" :style="{height:330*spec.height/spec.width+'rpx',background:background}"><image v-if="generated" :src="generated" mode="aspectFit"/><view v-else class="q-photo-transform" :style="{transform:`translate(${offsetX}%,${offsetY}%) scale(${scale/100})`}"><image v-if="image" :src="image" mode="aspectFill"/><view v-else class="q-sample-portrait"><view class="portrait-head" :style="portraitHead"/><view class="portrait-body" :style="portraitBody"/></view></view><view v-if="!generated" class="q-photo-guides"/></view><text class="q-small">{{generated?'已生成 · 当前本机图片':image?'本机照片 · 调整取景后生成':'示例头像 · 非真实人物照片'}}</text></view>
 <view v-if="error" class="q-error-summary" role="alert"><text>{{error}}</text></view><text v-if="feedback" class="q-field-hint" aria-live="polite">{{feedback}}</text>
 <view class="q-inline-actions"><button role="button" class="q-outline-button" :disabled="locked" @click="choose">{{choosing?'选图中':image?'更换照片':'选择本机照片'}}</button><button role="button" class="q-outline-button" :disabled="locked" @click="sample">使用示例</button></view>
 <view class="q-card q-content-card"><text class="q-row-title">取景与缩放</text><view class="q-slider-row"><text>缩放</text><slider :disabled="locked" :value="scale" :min="100" :max="200" active-color="#346c57" :block-size="22" @change="adjust('scale',$event)"/><text>{{scale}}%</text></view><view class="q-slider-row"><text>左右</text><slider :disabled="locked" :value="offsetX" :min="-50" :max="50" active-color="#346c57" :block-size="22" @change="adjust('x',$event)"/><text>{{offsetX}}</text></view><view class="q-slider-row"><text>上下</text><slider :disabled="locked" :value="offsetY" :min="-50" :max="50" active-color="#346c57" :block-size="22" @change="adjust('y',$event)"/><text>{{offsetY}}</text></view><text class="q-row-title">画布底色</text><view class="q-photo-colors"><button role="button" v-for="item in backgrounds" :key="item.color" :class="{active:background===item.color}" :disabled="locked" :aria-label="item.label+(background===item.color?'，已选择':'')" @click="color(item.color)"><view :style="{background:item.color}"/><text>{{item.label}}{{background===item.color?' · 已选':''}}</text></button></view><text class="q-field-hint">底色位于照片后方；原图有背景时会保留，不会自动抠图。</text></view>
 <view v-if="generated" class="q-card q-content-card"><text class="q-row-title">图片已在本机生成</text><view class="q-inline-actions"><button role="button" id="photo-apply" class="q-outline-button" :disabled="locked||appliedPath===generated" @click="useForResume">{{applying?'应用中':appliedPath===generated?'已应用到简历':'用作简历证件照'}}</button><button role="button" class="q-primary-button" :disabled="locked" @click="album">{{saving?'保存中':'保存图片'}}</button></view><button v-if="appliedPath===generated" role="button" class="q-text-button" @click="go('workspace')">查看当前简历 →</button></view>
 <canvas canvas-id="photo-export" id="photo-export" class="q-export-canvas" :style="{width:spec.width+'px',height:spec.height+'px'}"/>
 </template>
 </view></scroll-view><template v-if="mode==='photo-editor'" #footer><view class="q-footer-row"><view class="q-footer-primary"><ActionButton :label="busy?'生成中':generated?'重新生成图片':'生成本机预览'" :loading="busy" :disabled="locked" @click="generate"/></view></view></template></AppFrame></template>
