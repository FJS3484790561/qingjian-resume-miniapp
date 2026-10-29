<script setup lang="ts">
import { computed, ref,onBeforeUnmount } from 'vue'
import AppFrame from './AppFrame.vue'
import RichField from './RichField.vue'
import ActionButton from '../../components/ActionButton.vue'
import AppIcon from '../../components/AppIcon.vue'
import { definitions,basicFields,validateFields,entryHasContent,type ModuleId,type Entry,type Field } from './schema'
import { currentResume,clone,updateResume,message } from './store'
import { back } from './navigation'
import { useUnsavedGuard } from './useUnsavedGuard'
import { photoError } from './photo'
// #ifdef H5
import { localPhotoDataUrl } from './photo'
// #endif
const props=defineProps<{moduleId:string;entryId?:string}>()
const basic=computed(()=>props.moduleId==='basic')
const definition=computed(()=>definitions.find(d=>d.id===props.moduleId)||definitions[0])
const moduleId=computed(()=>definition.value.id)
const fields=computed(()=>basic.value?basicFields:definition.value.fields)
const existing=computed(()=>basic.value?currentResume.value.basic:currentResume.value.modules[moduleId.value].entries.find(e=>e.id===props.entryId)||(!definition.value.multi?currentResume.value.modules[moduleId.value].entries[0]:undefined))
const buffer=ref<Record<string,string>>(clone(existing.value||{id:'entry-'+Date.now().toString(36)}))
const initial=JSON.stringify(buffer.value)
const moduleName=ref(currentResume.value.modules[moduleId.value].name)
const initialName=moduleName.value
const errors=ref<Record<string,string>>({});const saving=ref(false);const errorAnchor=ref('');const saveError=ref('')
const photoBusy=ref(false);const photoFeedback=ref('');let photoGeneration=0
onBeforeUnmount(()=>{photoGeneration++})
const title=computed(()=>basic.value?'个人基本信息':currentResume.value.modules[moduleId.value].name)
const salaryRange=[['面议',...Array.from({length:48},(_,i)=>(i+2)+'k')],['面议',...Array.from({length:48},(_,i)=>(i+3)+'k')]]
function dirty(){return JSON.stringify(buffer.value)!==initial||moduleName.value!==initialName}
const unloadGuard=useUnsavedGuard(dirty,'这部分内容尚未保存，返回会放弃本次修改。')
async function beforeBack(){if(!dirty())return true;return new Promise<boolean>(resolve=>uni.showModal({title:'这部分还没有保存',content:'返回会放弃本次修改，已保存的内容仍会保留。',confirmText:'放弃修改',cancelText:'继续编辑',success:r=>{if(r.confirm)unloadGuard.clear();resolve(r.confirm)}}))}
defineExpose({isDirty:dirty,requestBack:async()=>{if(await beforeBack())back()}})
function value(field:Field,event:any){buffer.value[field.key]=String(event.detail.value);if(errors.value[field.key])errors.value=validateFields(buffer.value,fields.value)}
function select(field:Field,event:any){buffer.value[field.key]=field.options?.[Number(event.detail.value)]||''}
function salary(event:any){const [a,b]=event.detail.value.map(Number);if(!a||!b){buffer.value.salary='面议';return}const low=a+1,high=b+2;if(low>high){message('薪资上限不能低于下限，请重新选择');return}buffer.value.salary=`${low}k — ${high}k`}
async function save(){if(saving.value||photoBusy.value)return;saveError.value='';errors.value=validateFields(buffer.value,fields.value);if(Object.keys(errors.value).length){errorAnchor.value='form-errors';message('请检查标记的字段');return}saving.value=true
 const success=basic.value?updateResume(r=>{r.basic=clone(buffer.value)}):updateResume(r=>{const m=r.modules[moduleId.value];if(moduleId.value.startsWith('custom'))m.name=moduleName.value.trim()||definition.value.name;const i=m.entries.findIndex(e=>e.id===buffer.value.id);if(i>=0)m.entries[i]=clone(buffer.value) as Entry;else m.entries.push(clone(buffer.value) as Entry)})
 if(success){message('已保存');unloadGuard.clear();back()}else saveError.value='本机保存未完成，输入仍保留在当前页面。请勿关闭，稍后点击保存重试。';saving.value=false
}
function remove(){uni.showModal({title:basic.value?'清空基本信息？':'删除这条内容？',content:'仅影响当前简历。删除后可以重新添加。',confirmText:'删除',confirmColor:'#b2413e',success:r=>{if(!r.confirm)return;const done=updateResume(resume=>{if(basic.value)resume.basic={};else resume.modules[moduleId.value].entries=resume.modules[moduleId.value].entries.filter(e=>e.id!==buffer.value.id)});if(done){message('已删除');unloadGuard.clear();back()}}})}
function choosePhoto(){if(photoBusy.value||saving.value)return;photoBusy.value=true;photoFeedback.value='';const token=++photoGeneration;const valid=()=>token===photoGeneration;const fail=(e:unknown)=>{if(valid()){photoBusy.value=false;photoFeedback.value=photoError(e,'choose')}};const accept=(path:string)=>{if(valid()){buffer.value.photo=path;photoBusy.value=false;photoFeedback.value='照片已准备好，保存信息后写入当前简历。'}};uni.chooseImage({count:1,sizeType:['compressed'],sourceType:['album'],success:r=>{if(!valid())return;const path=r.tempFilePaths[0];if(!path){fail(null);return}
 // #ifdef MP-WEIXIN
 uni.saveFile({tempFilePath:path,success:s=>accept(s.savedFilePath),fail})
 // #endif
 // #ifdef H5
 localPhotoDataUrl(path).then(accept).catch(fail)
 // #endif
 },fail})}
</script>
<template>
 <AppFrame :title="title" :before-back="beforeBack">
  <scroll-view scroll-y class="q-scroll" :scroll-into-view="errorAnchor" :scroll-with-animation="false">
   <view class="q-page q-form-page">
    <text class="eyebrow">YOUR STORY, WELL TOLD.</text><text class="q-title">{{basic?'从认识你开始。':definition.description}}</text><text class="q-description">按需填写，不填的内容不会出现在简历里。</text>
    <view v-if="Object.keys(errors).length" id="form-errors" class="q-error-summary" role="alert"><text>请修改以下内容后保存</text><text v-for="(error,key) in errors" :key="key">{{fields.find(field=>field.key===key)?.label}}：{{error}}</text></view>
    <view v-if="saveError" class="q-error-summary" role="alert"><text>{{saveError}}</text><button role="button" class="q-text-button" @click="save">重试保存</button></view>
    <view v-if="basic" class="q-photo-upload"><button role="button" class="q-avatar-upload" :disabled="photoBusy" aria-label="选择简历证件照" @click="choosePhoto"><image v-if="buffer.photo" :src="buffer.photo" mode="aspectFill"/><AppIcon v-else name="photo" :size="28"/></button><view><text class="q-row-title">简历证件照</text><text class="q-small">选填 · 照片仅保存在当前设备</text><button v-if="buffer.photo" role="button" class="q-text-button" @click="buffer.photo=''">移除照片</button><button v-else role="button" class="q-text-button" :disabled="photoBusy" @click="choosePhoto">选择照片</button></view></view>
    <text v-if="photoBusy" class="q-field-hint">照片正在本机准备，请稍候…</text><text v-if="photoFeedback" class="q-field-hint" aria-live="polite">{{photoFeedback}}</text><view class="q-form-card">
     <view v-if="!basic&&moduleId.startsWith('custom')" class="q-field"><label for="module-name">模块名称</label><input id="module-name" v-model="moduleName" maxlength="20" aria-label="自定义模块名称"/><text class="q-field-hint">这个名称会显示在简历的分区标题中。</text></view>
     <view v-for="(field,index) in fields" :key="moduleId+field.key" class="q-field" :class="{'q-field-error':errors[field.key]}">
      <text v-if="basic&&index===3" class="q-form-divider">以下信息均为选填</text>
      <label :for="'f-'+field.key">{{field.label}}<text class="q-optional">{{basic&&index<3?'':'选填'}}</text></label>
      <view v-if="field.kind==='select'" class="q-picker-line"><picker mode="selector" :range="field.options||[]" :value="Math.max(0,(field.options||[]).indexOf(buffer[field.key]))" @change="select(field,$event)"><view class="q-picker-value" :class="{'q-placeholder':!buffer[field.key]}">{{buffer[field.key]||'请选择'}}<AppIcon name="down" :size="16"/></view></picker><button v-if="buffer[field.key]" role="button" class="q-clear" :aria-label="'清空'+field.label" @click="buffer[field.key]=''"><AppIcon name="close" :size="17"/></button></view>
      <view v-else-if="field.kind==='month'||field.kind==='date'" class="q-picker-line"><picker mode="date" :fields="field.kind==='month'?'month':'day'" :start="'1950-01-01'" :end="'2045-12-31'" :value="buffer[field.key]==='至今'?'':buffer[field.key]" @change="value(field,$event)"><view class="q-picker-value" :class="{'q-placeholder':!buffer[field.key]}">{{buffer[field.key]||'请选择时间'}}<AppIcon name="down" :size="16"/></view></picker><button v-if="field.key==='end'" role="button" class="q-now" :class="{active:buffer.end==='至今'}" @click="buffer.end=buffer.end==='至今'?'':'至今'">至今</button><button v-if="buffer[field.key]" role="button" class="q-clear" :aria-label="'清空'+field.label" @click="buffer[field.key]=''"><AppIcon name="close" :size="17"/></button></view>
      <view v-else-if="field.kind==='salary'" class="q-picker-line"><picker mode="multiSelector" :range="salaryRange" @change="salary"><view class="q-picker-value" :class="{'q-placeholder':!buffer.salary}">{{buffer.salary||'请选择薪资范围'}}<AppIcon name="down" :size="16"/></view></picker><button v-if="buffer.salary" role="button" class="q-clear" aria-label="清空期望薪资" @click="buffer.salary=''"><AppIcon name="close" :size="17"/></button></view>
      <RichField v-else-if="field.kind==='rich'" :model-value="buffer[field.key]||''" :label="field.label" :field-id="'rich-'+field.key" @update:model-value="buffer[field.key]=$event"/>
      <input v-else :id="'f-'+field.key" :value="buffer[field.key]||''" :type="field.kind==='number'?'digit':'text'" :maxlength="field.max||100" :placeholder="'填写'+field.label" :aria-label="field.label" :adjust-position="true" :cursor-spacing="100" @input="value(field,$event)"/>
      <text v-if="field.hint" class="q-field-hint">{{field.hint}}</text><text v-if="errors[field.key]" class="q-field-error-text">{{errors[field.key]}}</text><text v-if="field.max&&!field.kind" class="q-counter">{{(buffer[field.key]||'').length}} / {{field.max}}</text>
     </view>
    </view><text class="q-endnote">你的经历，值得被认真书写。</text>
   </view>
  </scroll-view>
  <template #footer><view class="q-footer-row"><button role="button" class="q-danger-button" :disabled="saving||photoBusy" @click="remove">{{basic?'清空':'删除'}}</button><view class="q-footer-primary"><ActionButton :label="saving?'保存中':'保存信息'" :loading="saving" :disabled="photoBusy" @click="save"/></view></view></template>
 </AppFrame>
</template>
