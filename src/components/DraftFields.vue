<script setup lang="ts">
import { computed } from 'vue'
import { contactErrors, type Draft, type Section } from '../data/prototype'
const props = defineProps<{ draft: Draft; section: Section; showErrors: boolean }>()
const emit = defineEmits<{ (e: 'change', key: keyof Draft, value: string): void; (e: 'blur'): void }>()
const errors = computed(() => props.showErrors ? contactErrors(props.draft) : { phone: '', email: '' })
function input(key: keyof Draft, event: any) { emit('change', key, event.detail.value) }
</script>
<template>
  <view class="draft-fields">
    <template v-if="section === 'basic'">
      <view class="field"><label for="resume-name">姓名</label><input id="resume-name" :value="draft.name" maxlength="20" placeholder="怎么称呼你" placeholder-class="field-placeholder" @input="input('name', $event)" /></view>
      <view class="field"><label for="resume-role">期望职位</label><input id="resume-role" :value="draft.role" maxlength="15" placeholder="例如：产品设计师" placeholder-class="field-placeholder" @input="input('role', $event)" /></view>
      <view class="field" :class="{ 'field-error': errors.phone }"><label for="resume-phone">手机号码 <text class="optional">选填</text></label><input id="resume-phone" :value="draft.phone" type="text" inputmode="numeric" maxlength="20" placeholder="便于招聘方联系你" placeholder-class="field-placeholder" @input="input('phone', $event)" @blur="emit('blur')" /><text v-if="errors.phone" class="error-message">{{ errors.phone }}</text></view>
      <view class="field" :class="{ 'field-error': errors.email }"><label for="resume-email">电子邮箱 <text class="optional">选填</text></label><input id="resume-email" :value="draft.email" type="text" maxlength="80" placeholder="name@example.com" placeholder-class="field-placeholder" @input="input('email', $event)" @blur="emit('blur')" /><text v-if="errors.email" class="error-message">{{ errors.email }}</text></view>
    </template>
    <template v-else-if="section === 'experience'">
      <view class="field"><label for="resume-school">毕业院校 <text class="optional">选填</text></label><input id="resume-school" :value="draft.school" maxlength="40" placeholder="填写学校名称" placeholder-class="field-placeholder" @input="input('school', $event)" /></view>
      <view class="field"><label for="resume-major">专业与学历 <text class="optional">选填</text></label><input id="resume-major" :value="draft.major" maxlength="40" placeholder="例如：工业设计 · 本科" placeholder-class="field-placeholder" @input="input('major', $event)" /></view>
      <view class="field"><label for="resume-experience">项目经历 <text class="optional">选填</text></label><textarea id="resume-experience" :value="draft.experience" maxlength="1000" :auto-height="false" :adjust-position="true" :cursor-spacing="28" placeholder="描述你的职责、行动和成果" placeholder-class="field-placeholder" @input="input('experience', $event)" /><text class="field-hint">写清你做了什么，以及带来了怎样的改变。</text></view>
      <view class="field"><label for="resume-skills">专业技能 <text class="optional">选填</text></label><input id="resume-skills" :value="draft.skills" maxlength="120" placeholder="例如：Figma、交互设计" placeholder-class="field-placeholder" @input="input('skills', $event)" /></view>
    </template>
    <template v-else>
      <view class="field"><label for="intention-role">期望职位 <text class="optional">选填</text></label><input id="intention-role" :value="draft.role" maxlength="15" placeholder="例如：产品设计师" placeholder-class="field-placeholder" @input="input('role', $event)" /></view>
      <view class="field"><label for="resume-city">期望城市 <text class="optional">选填</text></label><input id="resume-city" :value="draft.city" maxlength="15" placeholder="例如：杭州" placeholder-class="field-placeholder" @input="input('city', $event)" /></view>
      <view class="field"><label for="resume-salary">期望薪资 <text class="optional">选填</text></label><input id="resume-salary" :value="draft.salary" maxlength="30" placeholder="例如：面议" placeholder-class="field-placeholder" @input="input('salary', $event)" /><text class="field-hint">想进一步沟通，也可以先填写「面议」。</text></view>
    </template>
  </view>
</template>
