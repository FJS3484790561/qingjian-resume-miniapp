<script setup lang="ts">
import { ref,getCurrentInstance } from 'vue'
const props=defineProps<{modelValue:string;label:string;fieldId:string}>()
const emit=defineEmits<{(e:'update:modelValue',value:string):void}>()
const context=ref<UniApp.EditorContext>();const active=ref<Record<string,unknown>>({});const ready=ref(false)
const instance=getCurrentInstance()
const editorId=props.fieldId+'-'+Math.random().toString(36).slice(2,8)
const formats=[{name:'italic',label:'斜体',text:'I'},{name:'bold',label:'加粗',text:'B'},{name:'underline',label:'下划线',text:'U'},{name:'list',value:'ordered',label:'有序列表',text:'1.'},{name:'list',value:'bullet',label:'无序列表',text:'•'}]
function onReady(){uni.createSelectorQuery().in(instance?.proxy).select('#'+editorId).context((result:any)=>{context.value=result.context;context.value?.setContents({html:props.modelValue||'<p></p>',success:()=>{ready.value=true}})}).exec()}
function input(event:any){if(ready.value)emit('update:modelValue',event.detail.html||'')}
function format(item:typeof formats[number]){context.value?.format(item.name,item.value||'')}
</script>
<template><view class="q-rich" :class="{'is-ready':ready}"><view class="q-rich-toolbar"><button role="button" v-for="item in formats" :key="item.label" :aria-label="label+'：'+item.label" :disabled="!ready" :class="{active:active[item.name]===(item.value||true)}" @tap.stop.prevent="format(item)"><text :class="'format-'+item.name">{{item.text}}</text></button></view><editor :id="editorId" class="q-rich-editor" :read-only="!ready" :placeholder="'写下'+label+'，建议说明行动和成果'" :show-img-size="false" :show-img-toolbar="false" @ready="onReady" @input="input" @statuschange="active=$event.detail"/><text class="q-field-hint">支持加粗、斜体、下划线与列表 · 内容最多 10000 字</text></view></template>
