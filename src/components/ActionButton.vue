<script setup lang="ts">
withDefaults(defineProps<{ label: string; secondary?: boolean; loading?: boolean; disabled?: boolean; small?: boolean; arrow?: boolean }>(), { secondary: false, loading: false, disabled: false, small: false, arrow: false })
defineEmits<{ (e: 'click'): void }>()
</script>
<template>
  <view class="action-wrap" :class="{ 'is-secondary': secondary, 'is-small': small }">
    <wd-button role="button" :aria-label="label" :aria-disabled="disabled || loading" :type="secondary ? 'info' : 'primary'" :loading="loading" :disabled="disabled || loading" block :round="false" @click="$emit('click')">
      <text>{{ label }}</text><text v-if="arrow" class="action-arrow">↗</text>
    </wd-button>
  </view>
</template>
