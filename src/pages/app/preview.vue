<script setup lang="ts">
import { ref } from 'vue'
import { onLoad,onBackPress } from '@dcloudio/uni-app'
import Screen from '../../features/resume/PreviewPage.vue'
const query=ref<Record<string,string>>({});const ready=ref(false)
const screen=ref<InstanceType<typeof Screen>>()
onBackPress(event=>{if(event.from==='navigateBack'||!screen.value?.isDirty())return false;void screen.value.requestBack();return true})
onLoad(options=>{query.value=Object.fromEntries(Object.entries(options||{}).map(([k,v])=>[k,String(v||'')]));ready.value=true})
</script>
<template><Screen v-if="ready" ref="screen" /></template>
