<script setup lang="ts">
import { computed } from 'vue'
import { sampleDraft, templates, type Draft } from '../data/prototype'
const props = withDefaults(defineProps<{ draft?: Draft; templateId?: string; large?: boolean; accent?: string }>(), { large: false })
const content = computed(() => props.draft || sampleDraft)
const style = computed(() => templates.find(t => t.id === (props.templateId || content.value.templateId)) || templates[0])
</script>
<template>
  <view class="resume-paper" :class="['layout-' + style.layout, { 'paper-large': large }]" :style="{ '--document-accent': accent || style.color }" :aria-hidden="!large" aria-label="示例简历预览">
    <view v-if="style.layout === 'sidebar'" class="doc-side"><view class="doc-monogram">{{ content.name.slice(0, 1) || '简' }}</view><text>PROFILE</text><view class="side-rule" /><text>联系方式</text><text>{{ content.city }}</text></view>
    <view class="paper-content">
      <view class="doc-title"><text class="doc-name">{{ content.name || '姓名待填写' }}</text><text class="doc-en">CURRICULUM VITAE</text></view>
      <text class="doc-role">{{ content.role }}</text>
      <view class="doc-contact"><text>{{ content.phone }}</text><text>{{ content.email }}</text><text>{{ content.city }}</text></view>
      <view class="doc-section"><text class="doc-section-title">教育背景 <text>EDUCATION</text></text><view class="doc-line"><text>{{ content.school }}</text><text>{{ content.educationTime }}</text></view><text>{{ content.major }}</text><text class="doc-paragraph">主修课程：设计方法、用户研究、交互设计、产品策略</text></view>
      <view class="doc-section"><text class="doc-section-title">项目经历 <text>EXPERIENCE</text></text><text class="doc-paragraph doc-experience">{{ content.experience }}</text><view class="doc-placeholder-line" /><view class="doc-placeholder-line short" /></view>
      <view class="doc-section"><text class="doc-section-title">专业技能 <text>SKILLS</text></text><text class="doc-paragraph">{{ content.skills }}</text></view>
      <view class="doc-section"><text class="doc-section-title">求职意向 <text>OBJECTIVE</text></text><text>{{ content.role }} · {{ content.city }} · {{ content.salary }}</text></view>
      <view class="doc-footer"><text>认真对待每一份热爱</text><text>01</text></view>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.resume-paper{position:relative;overflow:hidden;width:100%;aspect-ratio:0.707;background:#fff;color:#33413c;font-size:10rpx;line-height:1.65;border:1px solid rgba(41,58,50,.07);text-align:left;box-shadow:0 8rpx 22rpx rgba(28,45,36,.04)}
.paper-content{position:relative;min-height:100%;padding:10% 8% 8%}.doc-title{display:flex;align-items:baseline;justify-content:space-between;gap:3%}.doc-name{white-space:nowrap;font-size:2.7em;font-weight:700;letter-spacing:.16em;color:var(--document-accent)}.doc-en{display:none;font-size:.7em;letter-spacing:.13em;color:#7d8581}.doc-role{display:block;font-size:1.2em;margin-top:1.5%;color:var(--document-accent)}.doc-contact{display:flex;flex-wrap:wrap;gap:0 1em;font-size:.9em;padding:4% 0 5%;color:#6a716d}.doc-section{margin:5% 0 0}.doc-section-title{display:block;border-bottom:1px solid var(--document-accent);padding-bottom:2%;margin-bottom:3%;font-size:1.2em;font-weight:600;color:var(--document-accent)}.doc-section-title text{font-size:.6em;letter-spacing:.08em;margin-left:.7em;font-weight:400}.doc-line{display:flex;justify-content:space-between;gap:4%;font-weight:600;font-size:.96em}.doc-paragraph{display:block;line-height:1.9;margin-top:2%}.doc-experience{white-space:pre-line}.doc-placeholder-line{height:1px;background:#edf0ed;margin-top:4%;width:97%}.short{width:74%}.doc-footer{display:flex;justify-content:space-between;margin-top:10%;font-size:.7em;color:#89918c;letter-spacing:.12em}.layout-editorial .doc-name{white-space:nowrap;font-family:'Songti SC','SimSun',serif;font-weight:400}.layout-editorial .doc-title{border-top:3px solid var(--document-accent);padding-top:7%}.layout-editorial .doc-section-title{border-color:#dfe3e1}.layout-sidebar .paper-content{margin-left:25%;padding:10% 6%}.doc-side{position:absolute;left:0;top:0;bottom:0;width:25%;background:var(--document-accent);color:#fff;padding:10% 3%;font-size:.78em;text-align:center}.doc-side text{display:block;margin:12% 0;opacity:.88}.doc-monogram{width:7em;height:8em;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:1.25em}.side-rule{height:1px;background:rgba(255,255,255,.35);margin:25% 0}.layout-sidebar .doc-en{display:none}.paper-large{font-size:20rpx;min-height:1000rpx;aspect-ratio:auto}.paper-large .paper-content{min-height:1000rpx}.paper-large .doc-name{white-space:nowrap;font-size:2.2em}.paper-large .doc-en{font-size:.55em}.paper-large .doc-section-title{font-size:1.12em}
</style>
