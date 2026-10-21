<script setup lang="ts">
import { computed,ref,getCurrentInstance } from 'vue'
import { onHide,onShow } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import { photoSpecs } from './schema'
import { go } from './navigation'
import { currentResume,updateResume,message } from './store'
const props=defineProps<{mode:'photos'|'photo-editor';selected?:string}>()
const spec=computed(()=>photoSpecs[Number(props.selected)||0]);const image=ref('');const scale=ref(100);const offsetX=ref(0);const offsetY=ref(0);const background=ref('#ffffff');const generated=ref('');const busy=ref(false);const saving=ref(false);const instance=getCurrentInstance()
let active=true;let generation=0;const storedPath=ref('')
onShow(()=>{active=true})
onHide(()=>{active=false;generation++;busy.value=false})
function invalidate(){generation++;generated.value='';storedPath.value='';busy.value=false}
const backgrounds=[{color:'#ffffff',label:'白色'},{color:'#5389bc',label:'蓝色'},{color:'#ae4746',label:'红色'},{color:'#e4e9e3',label:'浅灰'}]
function choose(){if(busy.value)return;uni.chooseImage({count:1,sizeType:['compressed'],sourceType:['album'],success:r=>{if(!active)return;image.value=r.tempFilePaths[0];invalidate();scale.value=100;offsetX.value=0;offsetY.value=0},fail:e=>{if(!e.errMsg?.includes('cancel'))message('未能选择照片，可使用示例继续体验')}})}
function sample(){invalidate();image.value='';scale.value=100;offsetX.value=0;offsetY.value=0}
function generate(){if(busy.value)return;invalidate();busy.value=true;const token=++generation;const valid=()=>active&&token===generation;const width=spec.value.width,height=spec.value.height;const ctx=uni.createCanvasContext('photo-export',instance?.proxy)
 ctx.setFillStyle(background.value);ctx.fillRect(0,0,width,height)
 const finish=()=>{if(!valid())return;ctx.draw(false,()=>{if(!valid())return;uni.canvasToTempFilePath({canvasId:'photo-export',width,height,destWidth:width,destHeight:height,fileType:'png',success:r=>{if(!valid())return;generated.value=r.tempFilePath;busy.value=false;message('已生成本机图片预览')},fail:()=>{if(!valid())return;busy.value=false;message('图片生成失败，请重试')}},instance?.proxy)})}
 if(image.value){uni.getImageInfo({src:image.value,success:info=>{if(!valid())return;const fit=Math.max(width/info.width,height/info.height)*scale.value/100;const w=info.width*fit,h=info.height*fit;ctx.drawImage(image.value,(width-w)/2+offsetX.value/100*width,(height-h)/2+offsetY.value/100*height,w,h);finish()},fail:()=>{if(!valid())return;busy.value=false;message('照片读取失败，请重新选择')}})}
 else {ctx.save();ctx.translate(width/2+offsetX.value/100*width,height/2+offsetY.value/100*height);ctx.scale(scale.value/100,scale.value/100);ctx.setFillStyle('#d8bfa6');ctx.beginPath();ctx.arc(0,-height*.12,width*.17,0,Math.PI*2);ctx.fill();ctx.setFillStyle('#354d44');ctx.beginPath();ctx.arc(0,height*.4,width*.44,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-width*.44,height*.4,width*.88,height*.3);ctx.restore();finish()}
}
function useForResume(){if(!generated.value)return
 // #ifdef MP-WEIXIN
 if(storedPath.value){if(updateResume(resume=>{resume.basic.photo=storedPath.value}))message('已添加到当前简历');return}
 uni.saveFile({tempFilePath:generated.value,success:r=>{storedPath.value=r.savedFilePath;generated.value=r.savedFilePath;if(updateResume(resume=>{resume.basic.photo=r.savedFilePath}))message('已添加到当前简历')},fail:()=>message('本机保存失败，请重试')})
 // #endif
 // #ifdef H5
 if(updateResume(resume=>{resume.basic.photo=generated.value}))message('已添加到当前简历')
 // #endif
}
function album(){if(saving.value||!generated.value)return;saving.value=true
 // #ifdef MP-WEIXIN
 uni.saveImageToPhotosAlbum({filePath:generated.value,success:()=>message('图片已保存到相册'),fail:e=>message(e.errMsg?.includes('cancel')?'已取消保存':'保存未完成，请在微信中检查相册权限'),complete:()=>{saving.value=false}})
 // #endif
 // #ifdef H5
 saving.value=false;uni.previewImage({urls:[generated.value]});message('浏览器中可预览图片并手动保存')
 // #endif
}
function adjust(which:'scale'|'x'|'y',event:any){invalidate();if(which==='scale')scale.value=event.detail.value;else if(which==='x')offsetX.value=event.detail.value;else offsetY.value=event.detail.value}
</script>
<template><AppFrame :title="mode==='photos'?'证件照':'制作'+spec.name+'证件照'"><scroll-view scroll-y class="q-scroll"><view class="q-page">
 <template v-if="mode==='photos'"><text class="eyebrow">A GOOD FIRST IMPRESSION.</text><text class="q-title">一寸之间，{{'\n'}}也藏着认真。</text><text class="q-description">选择需要的规格，再调整照片的取景。</text><view class="q-photo-spec-grid"><button role="button" v-for="(item,i) in photoSpecs" :key="item.name" class="q-card" @click="go('photo-editor',{selected:String(i)})"><view class="q-spec-art"><view :style="{aspectRatio:String(item.width/item.height)}"><AppIcon name="user" :size="30"/></view></view><text class="q-row-title">{{item.name}}</text><text class="q-small">{{item.mm}} mm</text><text class="q-small">{{item.width}} × {{item.height}} px</text><AppIcon class="q-spec-arrow" name="arrow" :size="16"/></button></view><view class="q-note"><AppIcon name="help" :size="20"/><text>照片仅在本机处理。可用示例测试；当前不含人像抠图、换装或美颜。</text></view></template>
 <template v-else><view class="q-between"><view><text class="eyebrow">PHOTO STUDIO</text><text class="q-title q-title-small">刚刚好的第一印象。</text></view><text class="q-badge">{{spec.name}}</text></view><text class="q-description">{{spec.mm}} mm · {{spec.width}} × {{spec.height}} px</text>
 <view class="q-photo-stage-wrap"><view class="q-photo-stage" :style="{aspectRatio:String(spec.width/spec.height),background:background}"><image v-if="generated" :src="generated" mode="aspectFit"/><view v-else class="q-photo-transform" :style="{transform:`translate(${offsetX}%,${offsetY}%) scale(${scale/100})`}"><image v-if="image" :src="image" mode="aspectFill"/><view v-else class="q-sample-portrait"><view class="portrait-head"/><view class="portrait-body"/></view></view><view v-if="!generated" class="q-photo-guides"/></view><text class="q-small">{{generated?'已生成 · 当前本机图片':image?'本机照片 · 调整取景后生成':'示例头像 · 非真实人物照片'}}</text></view>
 <view class="q-inline-actions"><button role="button" class="q-outline-button" @click="choose">{{image?'更换照片':'选择本机照片'}}</button><button role="button" class="q-outline-button" @click="sample">使用示例</button></view>
 <view class="q-card q-content-card"><text class="q-row-title">取景与缩放</text><view class="q-slider-row"><text>缩放</text><slider :value="scale" :min="100" :max="200" active-color="#346c57" :block-size="22" @change="adjust('scale',$event)"/><text>{{scale}}%</text></view><view class="q-slider-row"><text>左右</text><slider :value="offsetX" :min="-50" :max="50" active-color="#346c57" :block-size="22" @change="adjust('x',$event)"/><text>{{offsetX}}</text></view><view class="q-slider-row"><text>上下</text><slider :value="offsetY" :min="-50" :max="50" active-color="#346c57" :block-size="22" @change="adjust('y',$event)"/><text>{{offsetY}}</text></view><text class="q-row-title">画布底色</text><view class="q-photo-colors"><button role="button" v-for="item in backgrounds" :key="item.color" :class="{active:background===item.color}" @click="background=item.color;invalidate()"><view :style="{background:item.color}"/><text>{{item.label}}</text></button></view><text class="q-field-hint">底色位于照片后方；原图有背景时会保留，不会自动抠图。</text></view>
 <view v-if="generated" class="q-card q-content-card"><text class="q-row-title">图片已在本机生成</text><view class="q-inline-actions"><button role="button" class="q-outline-button" @click="useForResume">用作简历证件照</button><button role="button" class="q-primary-button" :disabled="saving" @click="album">{{saving?'保存中':'保存图片'}}</button></view></view>
 <canvas canvas-id="photo-export" id="photo-export" class="q-export-canvas" :style="{width:spec.width+'px',height:spec.height+'px'}"/>
 </template>
 </view></scroll-view><template v-if="mode==='photo-editor'" #footer><ActionButton :label="busy?'生成中':generated?'重新生成图片':'生成本机预览'" :loading="busy" @click="generate"/></template></AppFrame></template>
