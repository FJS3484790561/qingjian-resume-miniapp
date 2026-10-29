<script setup lang="ts">
import { computed,ref } from 'vue'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ResumePaper from '../../components/ResumePaper.vue'
import { templates,type Draft } from '../../data/prototype'
import { currentResume,state,updateState,storageStatus } from './store'
import { filledModules,plain } from './schema'
import { go } from './navigation'
const resume=currentResume
const filled=computed(()=>filledModules(resume.value).length)
const draft=computed<Draft>(()=>{const r=resume.value;const intention=r.modules.intention.entries[0]||{};const edu=r.modules.education.entries[0]||{};return {name:r.basic.name||'你的名字',role:intention.role||'期望职位',phone:r.basic.phone||'',email:r.basic.email||'',city:intention.city||r.basic.city||'',school:edu.name||'',major:[edu.major,edu.degree].filter(Boolean).join(' · '),educationTime:[edu.start,edu.end].filter(Boolean).join(' — '),experience:plain(r.modules.project.entries[0]?.content||''),skills:plain(Object.values(r.modules.skills.entries[0]||{}).slice(1).join('、')),salary:intention.salary||'',templateId:r.layout.templateId}})
const notice=ref(!state.agreed&&!storageStatus.blocked)
function accept(){if(updateState(next=>{next.agreed=true}))notice.value=false}
</script>
<template>
 <AppFrame tab="home"><scroll-view scroll-y class="q-scroll"><view class="home-content home-fern">
  <view class="home-greeting"><text class="eyebrow">A LITTLE CARE, A BETTER START</text><text class="home-title">让每一份经历，{{'\n'}}都被认真看见。</text><text class="home-subtitle">从一份好简历，开始新的可能。</text></view>
  <view class="fern-hero"><view class="hero-copy"><view class="pill"><view class="tiny-dot"/>你的下一程</view><text class="hero-title">好简历，{{'\n'}}不必从零开始</text><text class="hero-description">写下经历，选好样式{{'\n'}}把你想说的，清晰表达</text><button role="button" class="hero-link pressable" @click="go('workspace')"><text>开始制作</text><AppIcon name="arrow" :size="18"/></button></view><view class="hero-art"><view class="art-orbit"/><view class="art-paper-back"/><view class="hero-document"><ResumePaper :draft="draft"/></view><view class="art-stamp"><AppIcon name="check" :size="15"/>为你而写</view></view></view>
  <view class="utility-grid"><button role="button" class="utility-card pressable" @click="go('templates')"><view class="utility-icon"><AppIcon name="grid"/></view><text class="utility-label">简历样式</text><text class="utility-sub">找到你的表达</text></button><button role="button" class="utility-card pressable" @click="go('photos')"><view class="utility-icon photo"><AppIcon name="photo"/></view><text class="utility-label">证件照</text><text class="utility-sub">一寸好形象</text></button><button role="button" class="utility-card pressable" @click="go('word')"><view class="utility-icon word"><AppIcon name="word"/></view><text class="utility-label">WORD 模板</text><text class="utility-sub">电脑编辑更方便</text></button></view>
  <view class="section-heading"><text class="section-title">继续你的创作</text><button role="button" class="q-text-button" @click="go('drafts')">全部草稿 <AppIcon name="arrow" :size="14"/></button></view>
  <button role="button" class="draft-card pressable" @click="go('workspace')"><view class="draft-thumb"><ResumePaper :draft="draft"/></view><view class="draft-copy"><view class="inline-gap"><text class="draft-title">{{resume.title}}</text><text v-if="resume.sample" class="sample-label">示例</text></view><text class="muted">{{draft.role}} · {{draft.city||'城市待填写'}}</text><view class="draft-progress"><view :style="{width:Math.min(100,filled/6*100)+'%'}"/></view><text class="draft-meta">已填写 {{filled}} 个模块 · 继续完善</text></view><AppIcon name="arrow" :size="19"/></button>
  <view class="section-heading"><text class="section-title">把好印象，留在第一眼</text><button role="button" class="text-link" @click="go('templates')">全部样式 <AppIcon name="arrow" :size="14"/></button></view><view class="home-template-row"><button role="button" v-for="item in templates.slice(0,2)" :key="item.id" class="home-template pressable" @click="go('templates',{selected:item.id})"><view class="home-template-paper"><ResumePaper :template-id="item.id"/></view><view class="template-name-row"><text>{{item.name}}</text><text class="muted">{{item.category}}</text></view></button></view><view class="gentle-note"><view class="tiny-dot"/><text>每一次认真准备，都在靠近更好的自己。</text></view>
  <button role="button" class="q-build-label" @click="go('testing')">本机编辑 · 备份请前往「我的」</button>
 </view></scroll-view>
 <template #overlay><wd-popup :z-index="100" v-model="notice" position="center" :close-on-click-modal="false" custom-class="q-welcome-popup"><view class="q-welcome"><view class="q-avatar"><AppIcon name="leaf" :size="30"/></view><text class="q-sheet-title">认真书写，安心开始。</text><text class="q-description">欢迎体验轻简履。日常编辑先保存在本机，可到「我的 → 账号与简历备份」主动登录与备份。生成真实文件时会上传选中的简历和照片；AI 需配置服务并单独同意发送选中正文，会员支付仍为模拟。示例中的人物与经历均为虚构。</text><view class="q-inline-links"><button role="button" @click="go('article',{kind:'privacy'})">隐私说明</button><button role="button" @click="go('article',{kind:'terms'})">体验说明</button></view><button role="button" class="q-primary-button" @click="accept">了解并开始体验</button><button role="button" class="q-text-button q-center" @click="notice=false">先看看</button></view></wd-popup></template>
 </AppFrame>
</template>
