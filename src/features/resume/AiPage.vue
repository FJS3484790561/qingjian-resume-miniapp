<script setup lang="ts">
import { computed,ref,onBeforeUnmount } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import { definitions,plain,escapeHtml } from './schema'
import { currentResume,state,saveModule,clone,message } from './store'
import { go } from './navigation'
const targets=computed(()=>definitions.flatMap(d=>currentResume.value.modules[d.id].entries.filter(e=>plain(e.content||'')).map(e=>({module:d.id,id:e.id,name:currentResume.value.modules[d.id].name+' · '+(e.name||'正文'),content:e.content}))))
const selected=ref(0);const busy=ref(false);const result=ref('');const error=ref(false);const applied=ref(false);const previous=ref('');let active=true;let generation=0
const target=computed(()=>targets.value[selected.value])
function reset(){result.value='';error.value=false;applied.value=false}
function generate(){if(!target.value||busy.value)return;busy.value=true;reset();const token=++generation;const source=plain(target.value.content);setTimeout(()=>{if(!active||token!==generation)return;busy.value=false;if(state.simulation==='error'){error.value=true;return}result.value=source.split(/[。\n]/).filter(Boolean).map(s=>'• '+s.trim().replace(/^[•\s]+/,'')+'。').join('\n')},650)}
function apply(){if(!target.value)return;const entry=currentResume.value.modules[target.value.module].entries.find(e=>e.id===target.value.id)!;previous.value=entry.content;const next=clone(entry);next.content='<p>'+escapeHtml(result.value).replace(/\n/g,'</p><p>')+'</p>';if(saveModule(target.value.module,next)){applied.value=true;message('示例改写已应用，可撤销')}}
function undo(){if(!target.value)return;const entry=clone(currentResume.value.modules[target.value.module].entries.find(e=>e.id===target.value.id)!);entry.content=previous.value;if(saveModule(target.value.module,entry)){applied.value=false;result.value='';message('已恢复原文')}}
onBeforeUnmount(()=>{active=false;generation++})
onHide(()=>{generation++;busy.value=false})
</script>
<template><AppFrame title="智能优化"><scroll-view scroll-y class="q-scroll"><view class="q-page"><view class="pill"><AppIcon name="sparkle" :size="16"/>让内容更清楚一点</view><text class="q-title">你的积累，{{'\n'}}值得更好的表达。</text><view class="q-note"><AppIcon name="help" :size="20"/><text>当前是本机交互演示，按原文分句整理为要点，没有调用 AI，也不会编造经历或成果。</text></view>
 <view v-if="!targets.length" class="q-empty q-card"><AppIcon name="edit" :size="34"/><text class="q-row-title">还没有可整理的正文</text><text class="q-small">先添加项目、工作、自我评价等内容。</text><button role="button" class="q-text-button" @click="go('workspace')">返回填写 →</button></view>
 <template v-else><view class="q-form-card q-content-card"><text class="q-row-title">选择要整理的内容</text><picker :range="targets.map(t=>t.name)" :value="selected" :disabled="busy||applied" @change="selected=Number($event.detail.value);reset()"><view class="q-picker-value">{{target?.name}}<AppIcon name="down" :size="17"/></view></picker></view><view class="q-card q-content-card"><text class="q-row-title">原文</text><rich-text :nodes="previous&&applied?previous:target?.content||''"/></view><view v-if="error" class="q-error-summary"><text>模拟服务暂时不可用，原文已保留。</text><button role="button" class="q-text-button" @click="generate">重试</button></view><view v-if="result" class="q-card q-content-card"><view class="q-between"><text class="q-row-title">整理后的表达</text><text class="q-badge">本机示例</text></view><textarea v-model="result" class="q-ai-result" maxlength="10000" :disabled="applied" aria-label="编辑示例改写"/><text class="q-field-hint">请检查内容准确性后再应用，可以继续修改。</text><button v-if="applied" role="button" class="q-text-button" @click="undo">撤销应用，恢复原文</button><view v-else class="q-inline-actions"><button role="button" class="q-outline-button" @click="reset">保留原文</button><button role="button" class="q-primary-button" @click="apply">应用示例改写</button></view></view><text v-if="busy" class="q-small q-center">正在整理，原文不会被覆盖…</text></template></view></scroll-view><template v-if="targets.length" #footer><ActionButton :label="busy?'正在整理':result?'重新演示整理':'体验整理效果'" :loading="busy" :disabled="applied" @click="generate"/></template></AppFrame></template>
