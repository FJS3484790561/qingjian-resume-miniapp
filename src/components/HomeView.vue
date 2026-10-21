<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import ActionButton from './ActionButton.vue'
import ResumePaper from './ResumePaper.vue'
import { templates, type Draft, type Variant } from '../data/prototype'
defineProps<{ variant: Variant; draft: Draft; saved: boolean }>()
const emit = defineEmits<{ (e: 'edit'): void; (e: 'templates'): void; (e: 'tool', name: string): void; (e: 'template', id: string): void }>()
const utilities = [{ icon: 'photo', label: '证件照', sub: '一寸好形象' }, { icon: 'word', label: 'WORD 模板', sub: '电脑编辑更方便' }]
</script>
<template>
  <view class="home-content" :class="'home-' + variant">
    <template v-if="variant === 'fern'">
      <view class="home-greeting"><text class="eyebrow">A LITTLE CARE, A BETTER START</text><text class="home-title">让每一份经历，{{ '\n' }}都被认真看见。</text><text class="home-subtitle">从一份好简历，开始新的可能。</text></view>
      <view class="fern-hero">
        <view class="hero-copy"><view class="pill light"><view class="tiny-dot" />你的下一程</view><text class="hero-title">好简历，{{ '\n' }}不必从零开始</text><text class="hero-description">写下经历，选好样式{{ '\n' }}把你想说的，清晰表达</text><button role="button" class="hero-link pressable" @click="emit('edit')"><text>开始制作</text><AppIcon name="arrow" :size="18" /></button></view>
        <view class="hero-art"><view class="art-orbit" /><view class="art-paper-back" /><view class="hero-document"><ResumePaper :draft="draft" /></view><view class="art-stamp"><AppIcon name="check" :size="15" /> 为你而写</view></view>
      </view>
      <view class="utility-grid"><button role="button" class="utility-card pressable" @click="emit('templates')"><view class="utility-icon"><AppIcon name="grid" /></view><text class="utility-label">简历样式</text><text class="utility-sub">找到你的表达</text></button><button role="button" v-for="item in utilities" :key="item.label" class="utility-card pressable" @click="emit('tool', item.label)"><view class="utility-icon" :class="item.icon"><AppIcon :name="item.icon" /></view><text class="utility-label">{{ item.label }}</text><text class="utility-sub">{{ item.sub }}</text></button></view>
      <view class="section-heading"><text class="section-title">继续你的创作</text><text class="section-caption">好内容，值得慢慢打磨</text></view>
      <button role="button" class="draft-card pressable" @click="emit('edit')"><view class="draft-thumb"><ResumePaper :draft="draft" /></view><view class="draft-copy"><view class="inline-gap"><text class="draft-title">{{ draft.name || '我' }}的求职简历</text><text class="sample-label">示例</text></view><text class="muted">{{ draft.role || '职位待填写' }} · {{ draft.city }}</text><view class="draft-progress"><view /></view><text class="draft-meta">{{ saved ? '刚刚保存' : '已填写 4 个模块' }} · 继续完善</text></view><AppIcon name="arrow" :size="19" /></button>
      <view class="section-heading"><text class="section-title">把好印象，留在第一眼</text><button role="button" class="text-link" @click="emit('templates')">全部样式 <AppIcon name="arrow" :size="14" /></button></view>
      <view class="home-template-row"><button role="button" v-for="item in templates.slice(0, 2)" :key="item.id" class="home-template pressable" @click="emit('template', item.id)"><view class="home-template-paper"><ResumePaper :template-id="item.id" /></view><view class="template-name-row"><text>{{ item.name }}</text><text class="muted">{{ item.category }}</text></view></button></view>
      <view class="gentle-note"><view class="tiny-dot" /><text>每一次认真准备，都在靠近更好的自己。</text></view>
    </template>

    <template v-else-if="variant === 'paper'">
      <view class="paper-issue"><text>THE RESUME STUDIO</text><text>为下一程，认真落笔</text></view>
      <view class="paper-hero"><text class="paper-kicker">一份简历 / 无限可能</text><text class="home-title">你的经历，{{ '\n' }}值得好好书写。</text><view class="paper-intro"><text>少一些复杂，{{ '\n' }}多一些属于你的表达。</text><view class="paper-seal">简{{ '\n' }}<text>RESUME</text></view></view><ActionButton label="制作我的简历" arrow @click="emit('edit')" /></view>
      <view class="editorial-section-title"><text>01</text><text>正在书写</text><text class="editorial-en">IN PROGRESS</text></view>
      <button role="button" class="paper-draft pressable" @click="emit('edit')"><view class="paper-draft-left"><text class="sample-label">示例草稿</text><text class="paper-draft-name">{{ draft.name || '我' }}<text>的求职简历</text></text><text class="muted">{{ draft.role }} / {{ draft.city }}</text><text class="draft-meta">{{ saved ? '刚刚保存' : '4 个模块已完成' }}，继续写下你的故事</text></view><view class="paper-draft-preview"><ResumePaper :draft="draft" template-id="space" /></view><view class="paper-draft-arrow"><AppIcon name="arrow" :size="20" /></view></button>
      <view class="editorial-section-title"><text>02</text><text>选择一种表达</text><text class="editorial-en">THE COLLECTION</text></view>
      <button role="button" class="paper-feature pressable" @click="emit('templates')"><view class="paper-feature-image"><view class="feature-paper-one"><ResumePaper template-id="space" /></view><view class="feature-paper-two"><ResumePaper template-id="clear" /></view></view><view class="paper-feature-caption"><view><text class="serif">好的排版，让内容说话。</text><text class="muted">简约 / 商务 / 应届生</text></view><view class="square-arrow"><AppIcon name="arrow" :size="20" /></view></view></button>
      <view class="paper-tools"><button role="button" v-for="(item, index) in utilities" :key="item.label" class="paper-tool-row pressable" @click="emit('tool', item.label)"><text class="tool-number">0{{ index + 3 }}</text><text>{{ item.label }}</text><text class="muted">{{ item.sub }}</text><AppIcon name="arrow" :size="18" /></button></view>
      <view class="paper-endnote"><text>纸短，热爱很长。</text><text>MAKE YOUR NEXT CHAPTER.</text></view>
    </template>

    <template v-else>
      <view class="sky-greeting"><view class="inline-gap"><text class="eyebrow">准备好，向前一步</text><view class="sky-sun"><view /></view></view><text class="home-title">下一份机会，{{ '\n' }}从这里出发。</text><text class="home-subtitle">把值得的经历，变成看得见的优势。</text></view>
      <view class="sky-workbench"><view class="workbench-top"><text class="pill">我的简历工作台</text><text class="sample-label">示例</text></view><view class="workbench-main"><view class="sky-avatar">{{ draft.name.slice(0, 1) || '简' }}</view><view><text class="workbench-name">{{ draft.name || '我' }}的求职简历</text><text class="muted">{{ draft.role }} · {{ draft.city }}</text></view><text class="workbench-progress">4<text>/6</text></text></view><view class="task-progress"><view /></view><view class="workbench-caption"><text>4 个模块已填写</text><text>再完善一点，更出彩</text></view><ActionButton label="继续完善简历" arrow @click="emit('edit')" /></view>
      <view class="sky-bento"><button role="button" class="sky-template-entry pressable" @click="emit('templates')"><view class="utility-icon"><AppIcon name="grid" /></view><text class="bento-title">挑一个好样式</text><text class="muted">让优势一目了然</text><view class="bento-sheets"><view><ResumePaper template-id="clear" /></view><view><ResumePaper template-id="order" /></view></view><AppIcon name="arrow" :size="18" /></button><view class="sky-side-tools"><button role="button" v-for="item in utilities" :key="item.label" class="sky-tool pressable" @click="emit('tool', item.label)"><AppIcon :name="item.icon" :size="23" /><text>{{ item.label }}</text><text class="muted">{{ item.icon === 'photo' ? '一寸好形象' : '电脑轻松编辑' }}</text></button></view></view>
      <view class="section-heading"><view><text class="section-title">适合你的第一印象</text><text class="section-caption">内容一样，表达可以很不一样</text></view><button role="button" class="icon-button" aria-label="查看全部简历样式" @click="emit('templates')"><AppIcon name="arrow" :size="20" /></button></view>
      <view class="sky-recommendations"><button role="button" v-for="item in templates.slice(0, 2)" :key="item.id" class="sky-recommendation pressable" @click="emit('template', item.id)"><view class="sky-rec-paper"><ResumePaper :template-id="item.id" /></view><text>{{ item.name }}</text><text class="muted">{{ item.label }}</text></button></view>
      <view class="gentle-note"><AppIcon name="check" :size="14" /><text>一步一步来，好机会值得认真准备。</text></view>
    </template>
  </view>
</template>
