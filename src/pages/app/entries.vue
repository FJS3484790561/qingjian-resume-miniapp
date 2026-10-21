<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import Screen from '../../features/resume/ResumeWorkspace.vue'
const query=ref<Record<string,string>>({});const ready=ref(false)
onLoad(options=>{query.value=Object.fromEntries(Object.entries(options||{}).map(([k,v])=>[k,String(v||'')]));ready.value=true})
</script>
<template><Screen v-if="ready" mode="entries" :module-id="query.module"/></template>
