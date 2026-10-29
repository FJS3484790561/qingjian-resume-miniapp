<script setup lang="ts">
import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import { currentResume,updateResume,message,clone } from './store'
import { definitions,filledModules,plain,sortedEntries,entryHasContent,type ModuleId } from './schema'
import { go,back } from './navigation'
import { useUnsavedGuard } from './useUnsavedGuard'
const props=defineProps<{mode:'workspace'|'entries'|'manage';moduleId?:string}>()
const resume=currentResume
const filled=computed(()=>filledModules(resume.value))
const definition=computed(()=>definitions.find(d=>d.id===props.moduleId)||definitions[1])
const entries=computed(()=>sortedEntries(resume.value,definition.value.id))
const open=(id:ModuleId)=>go(definitions.find(d=>d.id===id)?.multi?'entries':'module',{module:id})
const manageOrder=ref([...resume.value.order]);const manageModules=ref(clone(resume.value.modules));const busy=ref(false)
const manageError=ref('');const moveFeedback=ref('');let confirmingBack=false
const managed=computed(()=>manageOrder.value.filter(id=>resume.value.modules[id].entries.some(entryHasContent)))
const initialManage=JSON.stringify({order:manageOrder.value,modules:manageModules.value})
function dirty(){return props.mode==='manage'&&JSON.stringify({order:manageOrder.value,modules:manageModules.value})!==initialManage}
const unloadGuard=useUnsavedGuard(dirty,'模块设置尚未保存，返回会放弃本次调整。')
async function beforeBack(){if(!dirty())return true;if(confirmingBack)return false;confirmingBack=true;return new Promise<boolean>(resolve=>uni.showModal({title:'模块设置尚未保存',content:'返回会放弃本次名称、顺序和显示设置。',confirmText:'放弃修改',cancelText:'继续调整',success:r=>{if(r.confirm)unloadGuard.clear();resolve(r.confirm)},fail:()=>resolve(false),complete:()=>{confirmingBack=false}}))}
defineExpose({isDirty:dirty,requestBack:async()=>{if(await beforeBack())back()}})
function move(id:ModuleId,step:number){const visible=managed.value;const i=visible.indexOf(id),other=visible[i+step];if(!other)return;const a=manageOrder.value.indexOf(id),b=manageOrder.value.indexOf(other);[manageOrder.value[a],manageOrder.value[b]]=[manageOrder.value[b],manageOrder.value[a]];moveFeedback.value=`${manageModules.value[id].name}已移到第 ${i+step+1} 位，保存后生效`}
function saveManage(){manageError.value='';if(updateResume(r=>{r.order=[...manageOrder.value];for(const id of r.order){r.modules[id].name=manageModules.value[id].name.trim()||definitions.find(d=>d.id===id)!.name;r.modules[id].visible=manageModules.value[id].visible}})){message('模块设置已保存');unloadGuard.clear();back()}else manageError.value='模块设置未保存，当前调整仍保留，请重试。'}
function toggleChronological(){if(updateResume(r=>{r.chronological=!r.chronological}))message(resume.value.chronological?'已按时间正序排列':'已按时间倒序排列')}
function manageName(id:ModuleId,event:any){manageModules.value[id].name=String(event.detail.value)}
function manageVisible(id:ModuleId,event:any){manageModules.value[id].visible=Boolean(event.detail.value)}
let generateTimer:ReturnType<typeof setTimeout>|undefined
onHide(()=>{clearTimeout(generateTimer);busy.value=false})
function generate(){if(busy.value)return;const action=()=>{busy.value=true;generateTimer=setTimeout(()=>{busy.value=false;go('preview')},350)};if(!resume.value.basic.name?.trim())uni.showModal({title:'简历还差一个名字',content:'姓名等基本信息尚未填写，预览可能不完整。可以先看样式，稍后再补充。',confirmText:'仍要预览',cancelText:'返回补充',success:r=>{if(r.confirm)action();else go('module',{module:'basic'})}});else action()}
const summary=(id:ModuleId)=>{const e=resume.value.modules[id].entries.find(entryHasContent);return e?Object.entries(e).filter(([k,v])=>k!=='id'&&v).map(([,v])=>plain(v)).join(' · ').slice(0,65):'未填写'}
</script>
<template>
 <AppFrame :title="mode==='workspace'?'简历信息':mode==='manage'?'模块管理':resume.modules[definition.id].name" :before-back="beforeBack">
  <scroll-view scroll-y class="q-scroll"><view class="q-page">
   <template v-if="mode==='workspace'">
    <text class="eyebrow">慢慢写，好的经历值得被看见</text><text class="q-title">把你的故事，{{'\n'}}一块块拼完整。</text>
    <button role="button" class="q-basic-card q-card" aria-label="编辑个人基本信息" @click="go('module',{module:'basic'})"><image v-if="resume.basic.photo" class="q-basic-photo" :src="resume.basic.photo" mode="aspectFill"/><view v-else class="q-avatar">{{resume.basic.name?.slice(0,1)||'你'}}</view><view class="q-grow"><text class="q-row-title">{{resume.basic.name||'填写你的姓名'}}</text><text class="q-small">{{[resume.basic.gender,resume.basic.age&&resume.basic.age+'岁',resume.basic.city].filter(Boolean).join(' · ')||'点击补充基本信息与证件照'}}</text></view><AppIcon name="edit" :size="18"/></button>
    <view class="q-section-head"><text>已填写内容 <text class="q-count">{{filled.length}}</text></text><button role="button" class="q-text-button" @click="go('manage')">名称与顺序 <AppIcon name="arrow" :size="14"/></button></view>
    <view v-if="!filled.length" class="q-empty q-card"><AppIcon name="file" :size="30"/><text class="q-row-title">从一小段经历开始</text><text class="q-small">点击下方模块，为简历添上第一笔。</text></view>
    <button v-for="(id,index) in filled" :key="id" role="button" class="q-module-card q-card" @click="open(id)"><view class="module-number">{{String(index+1).padStart(2,'0')}}</view><view class="q-grow"><view class="q-between"><text class="q-row-title">{{resume.modules[id].name}}</text><text class="q-badge">{{resume.modules[id].visible?'已填写':'预览中隐藏'}}</text></view><text class="q-module-summary">{{summary(id)}}</text></view><AppIcon name="edit" :size="18"/></button>
    <view class="q-section-head"><text>添加内容</text><text class="q-small">只展示你填写的部分</text></view>
    <view class="q-add-grid"><button v-for="d in definitions.filter(d=>!filled.includes(d.id))" :key="d.id" role="button" @click="open(d.id)"><AppIcon :name="d.icon" :size="20"/><text>{{resume.modules[d.id].name}}</text><AppIcon name="plus" :size="15"/></button></view><text class="q-endnote">不用一次填完，随时都可以回来完善。</text>
   </template>
   <template v-else-if="mode==='entries'">
    <text class="eyebrow">EVERY EXPERIENCE COUNTS.</text><text class="q-title">{{definition.description}}</text><text class="q-description">可以添加多段经历，也可以先留空。</text>
    <view v-if="!entries.length" class="q-empty q-card"><AppIcon :name="definition.icon" :size="38"/><text class="q-row-title">还没有{{resume.modules[definition.id].name}}</text><text class="q-small">添加后会自动出现在简历内容中。</text></view>
    <button v-for="entry in entries" :key="entry.id" role="button" class="q-entry-card q-card" @click="go('module',{module:definition.id,id:entry.id})"><view class="q-between"><text class="q-row-title">{{entry.name||'未命名经历'}}</text><AppIcon name="edit" :size="18"/></view><text class="q-small">{{[entry.role,entry.major,entry.degree].filter(Boolean).join(' · ')}}</text><text class="q-small">{{[entry.start,entry.end].filter(Boolean).join(' — ')||'时间未填写'}}</text><text v-if="entry.content" class="q-entry-excerpt">{{plain(entry.content)}}</text></button>
   </template>
   <template v-else>
    <text class="eyebrow">MAKE IT YOURS.</text><text class="q-title">安排你的表达顺序。</text><text class="q-description">修改名称、调整位置，或暂时隐藏某一部分。只列出已填写的模块。</text>
    <view v-if="manageError" class="q-error-summary" role="alert"><text>{{manageError}}</text></view>
    <text v-if="moveFeedback" class="q-field-hint" aria-live="polite">{{moveFeedback}}</text>
    <view v-if="!managed.length" class="q-empty q-card"><AppIcon name="folder" :size="36"/><text>还没有可管理的模块</text><text class="q-small">先去填写一部分内容，再来安排顺序。</text><button role="button" class="q-text-button" @click="go('workspace')">去填写内容</button></view>
    <view v-for="(id,index) in managed" :key="id" class="q-manage-card q-card"><view class="q-between"><input :value="manageModules[id].name" maxlength="20" :aria-label="'模块名称：'+resume.modules[id].name" @input="manageName(id,$event)"/><switch :checked="manageModules[id].visible" color="#346c57" :aria-label="'显示'+manageModules[id].name" @change="manageVisible(id,$event)"/></view><view class="q-manage-actions"><text class="q-small">{{manageModules[id].visible?'显示在简历中':'已隐藏，内容仍保留'}}</text><button role="button" :disabled="index===0" :aria-label="'上移'+manageModules[id].name" @click="move(id,-1)">上移 ↑</button><button role="button" :disabled="index===managed.length-1" :aria-label="'下移'+manageModules[id].name" @click="move(id,1)">下移 ↓</button></view></view>
   </template>
  </view></scroll-view>
  <template #footer><view class="q-footer-row"><view v-if="mode==='workspace'" class="q-workspace-tools"><button role="button" @click="go('manage')"><AppIcon name="grid" :size="20"/><text>模块管理</text></button><button role="button" @click="toggleChronological"><AppIcon name="clock" :size="20"/><text>{{resume.chronological?'时间正序':'时间倒序'}}</text></button><button role="button" @click="go('ai')"><AppIcon name="sparkle" :size="20"/><text>智能优化</text></button></view><view class="q-footer-primary"><ActionButton v-if="mode==='workspace'" :label="busy?'正在排版':'生成简历'" :loading="busy" arrow @click="generate"/><ActionButton v-else-if="mode==='entries'" :label="'+ 添加更多'+resume.modules[definition.id].name" @click="go('module',{module:definition.id})"/><ActionButton v-else label="保存模块设置" @click="saveManage"/></view></view></template>
 </AppFrame>
</template>
