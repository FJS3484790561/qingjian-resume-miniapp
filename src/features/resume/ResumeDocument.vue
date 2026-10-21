<script setup lang="ts">
import { computed } from 'vue'
import { templates } from '../../data/prototype'
import { documentPages } from './document'
import { type Resume } from './schema'
const props=defineProps<{resume:Resume}>()
const intention=computed(()=>props.resume.modules.intention.visible?props.resume.modules.intention.entries[0]?.role||'':'')
const pages=computed(()=>documentPages(props.resume))
const template=computed(()=>templates.find(t=>t.id===props.resume.layout.templateId)||templates[0])
const style=computed(()=>({'--doc-accent':props.resume.layout.color,'--doc-font':([18,20,22,24,26][props.resume.layout.font]||22)+'rpx','--doc-line':[1.45,1.6,1.75,1.9,2.05][props.resume.layout.line],'--doc-gap':([18,24,30,38,46][props.resume.layout.gap]||30)+'rpx'}))
const detail=computed(()=>{const b=props.resume.basic;return [b.gender,b.age&&b.age+'岁',b.birth,b.city,b.wechat&&'微信 '+b.wechat,b.marriage,b.politics,b.ethnicity,b.hometown,b.height&&b.height+' CM',b.weight&&b.weight+' KG',b.school,b.major,b.degree,(b.customTitle1||b.customContent1)&&(b.customTitle1||'补充信息 1')+'：'+(b.customContent1||''),(b.customTitle2||b.customContent2)&&(b.customTitle2||'补充信息 2')+'：'+(b.customContent2||'')].filter(Boolean)})
</script>
<template>
 <view class="q-document-set" :style="style">
  <view v-if="resume.layout.cover!=='none'" class="q-document-cover" :class="'cover-'+resume.layout.cover"><view class="cover-circle"/><text class="q-cover-en">THE NEXT CHAPTER</text><text class="q-cover-title">个人简历</text><view class="q-cover-rule"/><text class="q-cover-name">{{resume.basic.name||'姓名待填写'}}</text><text>{{intention||'每一份经历，都值得被看见'}}</text><text class="q-cover-footer">CURRICULUM VITAE</text></view>
  <view v-for="(page,index) in pages" :key="index" class="q-document-page" :class="'doc-layout-'+template.layout">
   <view v-if="template.layout==='sidebar'" class="q-doc-sidebar"><text>{{resume.basic.name?.slice(0,1)||'简'}}</text><view/><text>PROFILE</text></view>
   <view class="q-doc-main"><view v-if="index===0" class="q-doc-heading"><view class="q-grow"><text class="q-doc-name">{{resume.basic.name||'姓名待填写'}}</text><text v-if="intention" class="q-doc-role">{{intention}}</text><view v-if="detail.length" class="q-doc-detail"><text v-for="item in detail" :key="item">{{item}}</text></view><text v-if="resume.basic.phone||resume.basic.email" class="q-doc-contact">{{[resume.basic.phone,resume.basic.email].filter(Boolean).join(' · ')}}</text></view><image v-if="resume.basic.photo" class="q-doc-photo" :src="resume.basic.photo" mode="aspectFill"/></view>
   <view v-for="block in page" :key="block.key" class="q-doc-block"><text v-if="block.section" class="q-doc-section">{{block.section}}</text><text v-if="block.title" class="q-doc-block-title">{{block.title}}</text><text v-if="block.meta" class="q-doc-meta">{{block.meta}}</text><rich-text v-if="block.html" :nodes="block.html" class="q-doc-rich"/></view>
   <view v-if="!page.length" class="q-doc-empty">还没有填写简历内容，返回编辑后即可在这里预览。</view>
   </view><view class="q-doc-page-number"><text>{{resume.title}}</text><text>{{String(index+1).padStart(2,'0')}} / {{String(pages.length).padStart(2,'0')}}</text></view>
  </view>
 </view>
</template>
