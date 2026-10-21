<script setup lang="ts">
import PrototypeStudio from '../../components/PrototypeStudio.vue'
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import type { Screen } from '../../data/prototype'
const view = ref<Screen>('home')
onLoad(query => { if (['home', 'templates', 'editor', 'preview'].includes(query?.view)) view.value = query!.view as Screen })
</script>
<template><PrototypeStudio variant="paper" :initial-screen="view" /></template>
