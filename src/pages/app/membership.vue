<script setup lang="ts">
import { ref } from 'vue'
import { onLoad,onBackPress } from '@dcloudio/uni-app'
import Screen from '../../features/resume/LibraryPages.vue'
const screen=ref<InstanceType<typeof Screen>>();
onBackPress(event=>{if(event.from==='navigateBack'||!screen.value?.hasOverlay())return false;screen.value.requestBack();return true})
const query=ref<Record<string,string>>({});const ready=ref(false)
onLoad(options=>{query.value=Object.fromEntries(Object.entries(options||{}).map(([k,v])=>[k,String(v||'')]));ready.value=true})
</script>
<template><Screen ref="screen" v-if="ready" mode="membership"/></template>
