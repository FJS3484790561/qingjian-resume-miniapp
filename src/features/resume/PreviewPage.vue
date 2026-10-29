<script setup lang="ts">
import { ref,computed } from 'vue'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import ResumeDocument from './ResumeDocument.vue'
import ResumePaper from '../../components/ResumePaper.vue'
import { templates } from '../../data/prototype'
import { currentResume,updateResume,message,state } from './store'
import { levels } from './schema'
import { go,back } from './navigation'
import { useUnsavedGuard } from './useUnsavedGuard'
const resume=currentResume
const panel=ref('');const title=ref(resume.value.title);const titleError=ref('');const zoom=ref(false)
const settingError=ref('');let confirmingClose=false
useUnsavedGuard(()=>panel.value==='rename'&&title.value!==resume.value.title,'简历名称尚未保存，返回会放弃本次修改。')
const selected=computed(()=>templates.find(t=>t.id===resume.value.layout.templateId)||templates[0])
const covers=[{id:'none',name:'不选择'},{id:'quiet',name:'安静留白'},{id:'arch',name:'下一程'},{id:'line',name:'书写之间'}]
const colors=['#416D5B','#3F5369','#326CA8','#6E8194','#A04443','#5D8C9F','#846F50','#525C78']
const tools=[{id:'cover',name:'封面',icon:'file'},{id:'color',name:'主题色',icon:'grid'},{id:'rename',name:'重命名',icon:'edit'},{id:'spacing',name:'字号间距',icon:'settings'}]
function setting(key:string,value:any){settingError.value='';if(!updateResume(r=>{Object.assign(r.layout,{[key]:value})}))settingError.value='设置未保存，仍使用原来的样式。请重新选择重试。'}
function openPanel(id:string){panel.value=id;title.value=resume.value.title;titleError.value='';settingError.value=''}
async function closePanel(){if(confirmingClose)return false;if(panel.value==='rename'&&title.value!==resume.value.title){confirmingClose=true;const discard=await new Promise<boolean>(resolve=>uni.showModal({title:'简历名称尚未保存',content:'关闭会放弃本次名称修改，已保存的名称不变。',confirmText:'放弃修改',cancelText:'继续编辑',success:r=>resolve(r.confirm),fail:()=>resolve(false),complete:()=>{confirmingClose=false}}));if(!discard)return false}panel.value='';titleError.value='';settingError.value='';return true}
async function beforeBack(){if(panel.value){await closePanel();return false}return true}
defineExpose({isDirty:()=>!!panel.value,requestBack:async()=>{if(await beforeBack())back()}})
function rename(){const value=title.value.trim();if(!value){titleError.value='请填写简历名称';return}if(/[\\/:*?"<>|]/.test(value)){titleError.value='名称不能包含 /、\\ 等文件名特殊字符';return}if(updateResume(r=>{r.title=value})){panel.value='';titleError.value='';message('简历已重命名')}else titleError.value='名称未保存，输入仍保留，请重试。'}
</script>
<template>
 <AppFrame title="我的简历" wide :before-back="beforeBack">
  <scroll-view scroll-y class="q-scroll"><view class="q-page"><view class="q-between"><view><text class="eyebrow">你写的内容，正在发光</text><text class="q-title q-title-small">这就是你的下一程。</text></view><button role="button" class="q-text-button" @click="zoom=!zoom">{{zoom?'适合屏幕':'放大阅读'}}</button></view><view class="q-preview-caption"><text>{{resume.title}}</text><text>{{resume.layout.cover==='none'?'无封面':'含封面'}} · 本机预览</text></view></view>
   <scroll-view :scroll-x="zoom" class="q-doc-scroll"><view class="q-doc-preview" :class="{'q-doc-zoom':zoom}"><ResumeDocument :resume="resume"/></view></scroll-view>
   <view class="q-page"><view class="q-section-head"><text>换一种表达</text><button role="button" class="q-text-button" @click="go('templates',{from:'preview'})">全部样式 <AppIcon name="arrow" :size="14"/></button></view><scroll-view scroll-x class="q-template-strip"><view class="q-template-strip-inner"><button role="button" v-for="item in templates" :key="item.id" :class="{active:resume.layout.templateId===item.id}" :aria-label="item.name+(resume.layout.templateId===item.id?'，已选中':'')" @click="setting('templateId',item.id)"><ResumePaper :template-id="item.id"/><text>{{item.name}}</text></button></view></scroll-view><view class="q-preview-selected"><AppIcon name="check" :size="16"/><text>当前样式：{{selected.name}}</text><button role="button" @click="go('workspace')">继续编辑 →</button></view><text class="q-endnote">当前为前端体验版，文档导出与线上服务尚未接入。</text></view>
  </scroll-view>
  <template #footer><view class="q-footer-row"><view class="q-preview-tools"><button role="button" v-for="tool in tools" :key="tool.id" @click="openPanel(tool.id)"><AppIcon :name="tool.icon" :size="21"/><text>{{tool.name}}</text></button></view><view class="q-footer-primary"><ActionButton label="下载文档" @click="go('download')"/></view></view></template>
  <template #overlay><wd-popup :z-index="100" :model-value="!!panel" position="bottom" :duration="state.reduced?0:180" :safe-area-inset-bottom="true" custom-class="q-popup" @update:model-value="!$event&&closePanel()"><view class="q-sheet"><view class="q-sheet-handle"/><view class="q-between"><text class="q-sheet-title">{{panel==='cover'?'给简历加一页封面':panel==='color'?'选择简历主题色':panel==='rename'?'重命名简历':'字号与间距'}}</text><button role="button" class="q-icon-button" aria-label="关闭设置" @click="closePanel"><AppIcon name="close"/></button></view>
    <view v-if="settingError" class="q-error-summary" role="alert"><text>{{settingError}}</text></view>
    <view v-if="panel==='cover'" class="q-cover-grid"><button role="button" v-for="cover in covers" :key="cover.id" :class="{active:resume.layout.cover===cover.id}" :aria-label="cover.name+(resume.layout.cover===cover.id?'，已选中':'')" @click="setting('cover',cover.id)"><view class="q-mini-cover" :class="'cover-'+cover.id"><text>{{cover.id==='none'?'／':'个人简历'}}</text><text v-if="cover.id!=='none'">{{resume.basic.name||'你的名字'}}</text></view><text>{{cover.name}}</text><AppIcon v-if="resume.layout.cover===cover.id" name="check" :size="17"/></button></view>
    <view v-if="panel==='color'" class="q-color-grid"><button role="button" v-for="(color,i) in colors" :key="color" :style="{background:color}" :aria-label="'主题色 '+(i+1)+(resume.layout.color===color?'，已选中':'')" @click="setting('color',color)"><AppIcon v-if="resume.layout.color===color" name="check" :size="24" color="#ffffff"/></button></view>
    <template v-if="panel==='rename'"><view class="q-sheet-input"><input v-model="title" maxlength="40" placeholder="填写简历名称" aria-label="简历名称"/><text class="q-field-hint">40 字以内，不包含 / 等文件名特殊字符</text><text v-if="titleError" class="q-field-error-text">{{titleError}}</text></view><ActionButton label="保存名称" @click="rename"/></template>
    <view v-if="panel==='spacing'" class="q-layout-settings"><view v-for="item in [{key:'font',label:'字体大小'},{key:'line',label:'行间距'},{key:'gap',label:'模块间距'}]" :key="item.key"><text class="q-row-title">{{item.label}}</text><view class="q-levels"><button role="button" v-for="(level,i) in levels" :key="level" :class="{active:resume.layout[item.key as 'font'|'line'|'gap']===i}" :aria-label="item.label+'：'+level+(resume.layout[item.key as 'font'|'line'|'gap']===i?'，已选中':'')" @click="setting(item.key,i)">{{level}}</button></view></view></view>
    <text v-if="panel!=='rename'" class="q-field-hint">选择后即时更新，设置会保存在当前简历中。</text>
   </view></wd-popup></template>
 </AppFrame>
</template>
