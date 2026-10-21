<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number; color?: string }>(), { size: 22, color: 'currentColor' })
const names: Record<string, string> = {
  arrow: 'arrow-right', back: 'arrow-left', down: 'arrow-down', edit: 'edit',
  file: 'file', grid: 'app', photo: 'picture', word: 'file-word', user: 'user',
  home: 'home', check: 'check', plus: 'add', close: 'close', settings: 'setting',
  clock: 'time', preview: 'view', download: 'download', help: 'help-circle',
  school: 'read', briefcase: 'folder', sparkle: 'star', search: 'search', mail: 'mail',
  more: 'more', folder: 'folder', leaf: 'check-outline'
}
</script>
<template><wd-icon aria-hidden="true" :name="names[name] || name" :size="size" :color="color" /></template>
