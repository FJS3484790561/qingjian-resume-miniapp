<script setup lang="ts">
import { computed, ref } from 'vue'
import { filters, templates, type Variant } from '../data/prototype'
import ResumePaper from './ResumePaper.vue'
import AppIcon from './AppIcon.vue'
defineProps<{ variant: Variant; selected: string }>()
const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'use'): void }>()
const filter = ref('全部')
const visible = computed(() => templates.filter(t => filter.value === '全部' || t.category === filter.value))
</script>
<template>
  <view class="templates-content" :class="'templates-' + variant">
    <view class="page-intro"><text class="eyebrow">{{ variant === 'paper' ? 'THE COLLECTION / 06' : '把第一印象，交给好排版' }}</text><text class="page-title">{{ variant === 'fern' ? '找到你的表达' : variant === 'paper' ? '内容为先，样式为衬。' : '选一份，适合你的' }}</text><text class="page-description">同样的经历，换一种清晰、得体的表达。</text></view>
    <view class="filter-row" role="tablist"><button v-for="item in filters" :key="item" class="filter-button" :class="{ active: filter === item }" :aria-selected="filter === item" role="tab" @click="filter = item">{{ item }}<text v-if="filter === item && variant === 'paper'"> / {{ visible.length }}</text></button></view>
    <view class="template-gallery" :class="{ 'editorial-gallery': variant === 'paper' }">
      <button role="button" v-for="(item, index) in visible" :key="item.id" class="template-tile pressable" :class="{ selected: selected === item.id }" :aria-label="item.name + (selected === item.id ? '，已选中' : '，点击选择')" @click="emit('select', item.id)">
        <view class="template-art" :class="'art-' + item.layout"><view class="template-paper-frame"><ResumePaper :template-id="item.id" /></view><view v-if="selected === item.id" class="template-selected"><AppIcon name="check" :size="13" /><text>已选</text></view><text v-if="variant === 'paper'" class="template-index">0{{ index + 1 }}</text></view>
        <view class="template-caption"><text class="template-title">{{ item.name }}</text><text class="template-label">{{ item.label }}</text><text v-if="variant === 'paper'" class="template-description">{{ item.description }}</text><view v-if="variant === 'paper'" class="editorial-select"><text>{{ selected === item.id ? '已选择此样式' : '选择这份样式' }}</text><AppIcon :name="selected === item.id ? 'check' : 'arrow'" :size="16" /></view></view>
      </button>
    </view>
    <view class="collection-end"><text>清晰表达，始终是最好的样式。</text><text class="muted">当前为 6 款示例样式，内容仅用于方案体验。</text></view>
  </view>
</template>
