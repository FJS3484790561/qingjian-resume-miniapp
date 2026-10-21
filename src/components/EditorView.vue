<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import DraftFields from './DraftFields.vue'
import { sectionLabels, type Draft, type Section, type Variant } from '../data/prototype'
const props = defineProps<{ variant: Variant; draft: Draft; step: number; showErrors: boolean }>()
const emit = defineEmits<{ (e: 'change', key: keyof Draft, value: string): void; (e: 'edit-section', section: Section): void; (e: 'step', step: number): void; (e: 'blur'): void; (e: 'tool', name: string): void }>()
const sections: Section[] = ['basic', 'experience', 'intention']
const stepSection = computed(() => sections[props.step])
const summaries = computed(() => [
  { id: 'basic' as Section, icon: 'user', name: '基本信息', sub: `${props.draft.name || '姓名待填写'} · ${props.draft.role || '职位待填写'}`, desc: '让招聘方认识你', status: props.draft.name ? '已填写' : '待完善' },
  { id: 'experience' as Section, icon: 'briefcase', name: '经历与能力', sub: props.draft.school || '教育、项目与专业技能', desc: '把你的积累，清楚地写下来', status: props.draft.school || props.draft.experience ? '已填写' : '待完善' },
  { id: 'intention' as Section, icon: 'folder', name: '求职意向', sub: `${props.draft.city || '城市待填写'} · ${props.draft.salary || '薪资待填写'}`, desc: '和更适合的机会相遇', status: props.draft.role ? '已填写' : '待完善' }
])
</script>
<template>
  <view class="editor-content" :class="'editor-' + variant">
    <template v-if="variant === 'fern'">
      <view class="page-intro"><text class="eyebrow">慢慢写，好的经历值得被看见</text><text class="page-title">把你的故事，{{ '\n' }}一块块拼完整。</text></view>
      <view class="editor-resume-label"><view class="inline-gap"><view class="avatar-dot">{{ draft.name.slice(0, 1) || '简' }}</view><view><text class="draft-title">{{ draft.name || '我' }}的求职简历</text><text class="draft-meta">示例内容 · 可自由修改</text></view></view><text class="small-status"><view class="tiny-dot" />草稿</text></view>
      <view class="module-label"><text>简历内容</text><text class="muted">只展示你填写的部分</text></view>
      <button role="button" v-for="(item, index) in summaries" :key="item.id" class="module-card pressable" @click="emit('edit-section', item.id)"><view class="module-number">0{{ index + 1 }}</view><view class="module-info"><view class="inline-gap"><text class="module-name">{{ item.name }}</text><text class="module-state">{{ item.status }}</text></view><text class="module-summary">{{ item.sub }}</text><text class="module-description">{{ item.desc }}</text></view><AppIcon name="edit" :size="18" /></button>
      <button role="button" class="add-module-button pressable" @click="emit('tool', '更多简历模块')"><AppIcon name="plus" :size="18" /><text>添加更多模块</text><text class="muted">工作、证书、自荐信等</text></button>
      <view class="editor-tip"><AppIcon name="help" :size="18" /><text>不用一次填完。先把最想展示的内容写下来，随时都可以回来完善。</text></view>
    </template>

    <template v-else-if="variant === 'paper'">
      <view class="paper-issue"><text>YOUR STORY, WELL TOLD.</text><text>示例内容</text></view><view class="page-intro"><text class="page-title">从认识你开始。</text><text class="page-description">每一行，都为你的下一程作铺垫。</text></view>
      <view class="paper-edit-document"><view v-for="(section, index) in sections" :key="section" class="paper-form-section"><view class="paper-form-title"><text class="form-section-number">0{{ index + 1 }}</text><text>{{ sectionLabels[section] }}</text><AppIcon :name="index === 0 ? 'user' : index === 1 ? 'briefcase' : 'folder'" :size="19" /></view><DraftFields :draft="draft" :section="section" :show-errors="showErrors" @change="(key, value) => emit('change', key, value)" @blur="emit('blur')" /></view></view><view class="paper-endnote"><text>此刻的积累，是下一程的底气。</text></view>
    </template>

    <template v-else>
      <view class="stepper"><button role="button" v-for="(section, index) in sections" :key="section" class="step" :class="{ current: step === index, done: step > index }" :aria-label="'第' + (index + 1) + '步，' + sectionLabels[section]" @click="emit('step', index)"><view class="step-bubble"><AppIcon v-if="step > index" name="check" :size="14" /><text v-else>{{ index + 1 }}</text></view><text>{{ index === 0 ? '认识你' : index === 1 ? '看见积累' : '下一程' }}</text></button></view>
      <view class="page-intro"><text class="eyebrow">STEP 0{{ step + 1 }} / 03</text><text class="page-title">{{ step === 0 ? '先介绍一下你自己' : step === 1 ? '你的积累，值得看见' : '下一程，想去哪里？' }}</text><text class="page-description">{{ step === 0 ? '写下联系方式，让好机会找到你。' : step === 1 ? '从一次项目、一段学习经历开始。' : '说清期待，向合适的机会靠近。' }}</text></view>
      <view class="sky-form-card"><view class="sky-form-heading"><text>{{ sectionLabels[stepSection] }}</text><text class="sample-label">示例内容</text></view><DraftFields :draft="draft" :section="stepSection" :show-errors="showErrors" @change="(key, value) => emit('change', key, value)" @blur="emit('blur')" /></view>
      <view class="sky-step-tip"><AppIcon name="check" :size="16" /><text>暂时没想好的内容可以留空，之后再补充。</text></view>
    </template>
  </view>
</template>
