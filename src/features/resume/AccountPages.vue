<script setup lang="ts">
import { computed,ref } from 'vue'
import AppFrame from './AppFrame.vue'
import AppIcon from '../../components/AppIcon.vue'
import ActionButton from '../../components/ActionButton.vue'
import { state,currentResume,createResume,activateResume,removeResume,persist,resetLocal,message } from './store'
import { plans,filledModules } from './schema'
import { go,type Route } from './navigation'
const props=defineProps<{mode:'profile'|'drafts'|'settings'|'help'|'article'|'downloads'|'testing';kind?:string}>()
const activeHelp=ref(-1)
const titles={profile:'我的',drafts:'我的简历',settings:'设置',help:'常见问题',article:'详情',downloads:'下载记录',testing:'前端测试台'}
const faqs=[{q:'从哪里开始制作简历？',a:'在首页点击「开始制作」，先填写基本信息，再按需要添加经历、技能和其他模块。只有填写过的内容才会出现在预览中。'},{q:'没有填完可以先看效果吗？',a:'可以。姓名留空时会提醒你补充，也允许继续预览。每个模块点击「保存信息」后保存在当前设备，返回首页可以继续完善。'},{q:'怎样调整模块名称和顺序？',a:'在简历信息页打开「模块管理」。已填写模块支持改名、上移、下移和显示开关。隐藏不删除内容，保存后更新预览。'},{q:'怎样切换模板、颜色和排版？',a:'生成预览后可以切换模板，选择封面和文档主题色，并分别调整字体、行间距和模块间距。文档主题色不会改变应用界面的青屿风格。'},{q:'为什么下载和会员显示模拟？',a:'当前按前端测试阶段开发，尚未接入后端、真实文件生成和微信支付。模拟完成仅表示交互流程结束，不代表真实付款或文件已经生成。'},{q:'证件照可以做什么？',a:'可以选择规格、使用示例或选择本机照片、调整取景与缩放，并生成本机图片预览。当前不提供人像抠图或换装；有背景的原图会保留原背景。'},{q:'为什么换设备后看不到简历？',a:'当前内容只保存在设备本机，没有账号同步。浏览器图片地址与小程序本地照片路径也不能跨设备使用。清理数据前请确认已保留需要的内容。'},{q:'长内容会被截断吗？',a:'预览按内容拆分续页，不主动截断已保存文字。当前分页按文字长度估算，并非最终 PDF 排版引擎；正式文件分页将在后端阶段单独验收。'}]
const article=computed(()=>{
 const map:Record<string,{title:string;sections:{title:string;text:string}[]}>= {
 privacy:{title:'隐私说明（前端体验版）',sections:[{title:'当前如何处理数据',text:'你输入的简历、选择的本机照片和模拟权益只存放在当前设备。应用代码不调用登录、上传、支付或 AI 网络服务。微信平台和开发者工具自身的数据处理遵循其平台规则。'},{title:'可选照片权限',text:'只有主动选择照片或保存图片时才会调用平台相册接口。你可以取消，也可以使用不涉及个人照片的示例素材。'},{title:'管理与删除',text:'可单独清空模块、删除草稿，或在设置中清空本机体验数据。删除本机数据不会注销微信账号。'},{title:'正式版本',text:'这份说明用于如实描述当前前端体验，不是已审核的正式隐私政策。账号、云端存储与服务商接入后需重新完善并审核。'}]},
 terms:{title:'前端体验说明',sections:[{title:'体验范围',text:'当前提供简历填写、编辑、模板和排版预览、证件照本机处理及模拟会员/下载/AI流程。所有标记为示例的数据、价格与结果仅供测试。'},{title:'不产生交易',text:'模拟开通和模拟下载不会扣款、不产生真实订单，也不代表获得正式权益或完成文件导出。'},{title:'内容与素材',text:'请使用你有权使用的照片和内容。示例人物、学校与项目是虚构数据，不是实际求职者资料。'}]},
 information:{title:'个人信息清单',sections:[{title:'简历资料',text:'姓名、联系方式、教育与工作经历等由你主动填写，用于在本机呈现简历预览；所有字段支持修改或删除。'},{title:'照片与本机数据',text:'照片由用户主动选择，保存为本机文件；草稿设置、模拟权益、下载记录保存在本地存储。'},{title:'当前简历',text:'当前共有 '+state.resumes.length+' 份本机草稿。没有云端账号或跨设备同步。'}]},
 sdk:{title:'SDK 共享清单',sections:[{title:'当前前端',text:'使用 uni-app 运行时和 Wot Design Uni 界面组件，未主动接入统计、广告、登录、支付或 AI 等第三方服务 SDK。'},{title:'后续接入',text:'新增云端服务或第三方 SDK 后，需要同步更新用途、信息类型、接收方与隐私规则。'}]},
 contact:{title:'联系客服',sections:[{title:'服务入口待配置',text:'当前未配置正式客服微信或二维码，因此不会展示虚构联系方式。你可以先通过前端测试台复现问题，并向开发人员反馈所在页面、操作步骤和截图。'},{title:'反馈建议',text:'请说明问题发生在哪个模块、点击了什么、预期结果和实际结果。无需提供真实身份证号、付款信息或其他敏感资料。'}]}
 };return map[props.kind||'terms']||map.terms
})
function add(sample=false){createResume(sample);go('workspace')}
function deleteDraft(id:string){uni.showModal({title:'删除这份本机简历？',content:'这会删除当前设备上的这份草稿，无法恢复。其他简历不受影响。',confirmText:'删除',confirmColor:'#b2413e',success:r=>{if(r.confirm){removeResume(id);message('草稿已删除')}}})}
function clear(){uni.showModal({title:'清空本机体验数据？',content:'将删除本机简历、照片引用、模拟权益和下载记录，并恢复初始示例。不会操作任何微信账号。',confirmText:'清空数据',confirmColor:'#b2413e',success:r=>{if(r.confirm){resetLocal();message('已恢复初始体验数据');go('home')}}})}
function longSample(){const r=createResume(true);r.title='长内容与多经历测试';r.modules.project.entries[0].content='<p>'+Array.from({length:35},(_,i)=>`第 ${i+1} 项：参与用户访谈与方案迭代，梳理关键操作路径，协助完成页面原型和交互说明。`).join('</p><p>')+'</p>';r.modules.education.entries.push({id:'earlier-education',name:'青禾实验学校',start:'2019-09',end:'2022-06',degree:'高中'});persist();go('workspace')}
function date(time:number){return new Date(time).toLocaleDateString('zh-CN')}
function motion(event:any){state.reduced=Boolean(event.detail.value);persist()}
const testRoutes:{label:string;route:Route}[]=[{label:'简历填写与模块',route:'workspace'},{label:'预览与排版',route:'preview'},{label:'证件照制作',route:'photos'},{label:'WORD 模板',route:'word'},{label:'会员模拟流程',route:'membership'},{label:'AI 优化演示',route:'ai'},{label:'下载模拟流程',route:'download'},{label:'三套历史方案对比',route:'home'}]
</script>
<template>
 <AppFrame :title="mode==='article'?article.title:titles[mode]" :tab="mode==='profile'?'profile':undefined">
  <scroll-view scroll-y class="q-scroll"><view class="q-page">
   <template v-if="mode==='profile'">
    <view class="q-profile-head"><view class="q-avatar q-avatar-large"><AppIcon name="user" :size="33"/></view><view><text class="q-title q-title-small">你好，认真生活的你。</text><text class="q-small">每一次准备，都在靠近更好的自己。</text></view></view>
    <button role="button" class="q-member-banner" @click="go('membership')"><view><text class="q-row-title">{{state.member===null?'让准备更从容':plans[state.member].name+' · 模拟权益'}}</text><text class="q-small">{{state.member===null?'了解下载权益，选择适合的方式':'仅在本机演示生效，没有实际付款'}}</text></view><AppIcon name="arrow"/></button>
    <view class="q-card q-menu"><button role="button" @click="go('drafts')"><AppIcon name="file"/><text>我的简历</text><text class="q-menu-meta">{{state.resumes.length}} 份</text><AppIcon name="arrow" :size="16"/></button><button role="button" @click="go('downloads')"><AppIcon name="download"/><text>下载记录</text><text class="q-menu-meta">{{state.exports.length}} 条模拟记录</text><AppIcon name="arrow" :size="16"/></button></view>
    <view class="q-card q-menu"><button role="button" @click="go('article',{kind:'contact'})"><AppIcon name="mail"/><text>客服微信</text><AppIcon name="arrow" :size="16"/></button><button role="button" @click="go('help')"><AppIcon name="help"/><text>常见问题</text><AppIcon name="arrow" :size="16"/></button><button role="button" @click="go('settings')"><AppIcon name="settings"/><text>设置</text><AppIcon name="arrow" :size="16"/></button></view><button role="button" class="q-build-label" @click="go('testing')">前端体验版 · 打开测试台</button>
   </template>
   <template v-else-if="mode==='drafts'">
    <text class="eyebrow">YOUR NEXT CHAPTERS.</text><text class="q-title">每份准备，都妥善保存。</text><text class="q-description">本机共有 {{state.resumes.length}} 份简历，当前使用「{{currentResume.title}}」。</text>
    <view v-for="r in state.resumes" :key="r.id" class="q-draft-row q-card"><button role="button" class="q-draft-main" @click="activateResume(r.id);go('workspace')"><view class="q-avatar">{{r.basic.name?.slice(0,1)||'简'}}</view><view class="q-grow"><view class="q-between"><text class="q-row-title">{{r.title}}</text><text v-if="r.id===state.currentId" class="q-badge">当前</text></view><text class="q-small">{{r.sample?'虚构示例 · ':''}}{{filledModules(r).length}} 个模块 · {{date(r.updatedAt)}}</text></view></button><view class="q-draft-actions"><button role="button" @click="activateResume(r.id);go('preview')">预览</button><button role="button" class="q-danger-text" @click="deleteDraft(r.id)">删除</button></view></view>
    <button role="button" class="q-outline-button" @click="add(true)">从示例再建一份</button>
   </template>
   <template v-else-if="mode==='settings'">
    <text class="q-title">留一份安心，给自己。</text><view class="q-card q-menu"><button role="button" @click="go('article',{kind:'information'})"><text>个人信息清单</text><AppIcon name="arrow" :size="16"/></button><button role="button" @click="go('article',{kind:'sdk'})"><text>SDK 共享清单</text><AppIcon name="arrow" :size="16"/></button><button role="button" @click="go('article',{kind:'privacy'})"><text>隐私说明</text><AppIcon name="arrow" :size="16"/></button><button role="button" @click="go('article',{kind:'terms'})"><text>体验说明</text><AppIcon name="arrow" :size="16"/></button></view>
    <view class="q-card q-setting-row"><view><text class="q-row-title">减少动态效果</text><text class="q-small">保留必要操作反馈，减少过渡动画</text></view><switch :checked="state.reduced" color="#346c57" @change="motion"/></view>
    <view class="q-card q-content-card"><text class="q-row-title">账号注销</text><text>当前没有登录或云端账号。如需重新测试，可以清空当前设备上的体验数据。</text><button role="button" class="q-danger-text q-text-button" @click="clear">清空本机体验数据</button></view><text class="q-endnote">轻简履 · 青屿前端体验版 0.2.0</text>
   </template>
   <template v-else-if="mode==='help'"><text class="eyebrow">A LITTLE HELP.</text><text class="q-title">一点帮助，少些困惑。</text><view v-for="(item,i) in faqs" :key="item.q" class="q-faq q-card"><button role="button" class="q-between" :aria-expanded="activeHelp===i" @click="activeHelp=activeHelp===i?-1:i"><text>{{item.q}}</text><AppIcon :name="activeHelp===i?'close':'plus'" :size="18"/></button><text v-if="activeHelp===i" class="q-faq-answer">{{item.a}}</text></view></template>
   <template v-else-if="mode==='article'"><text class="eyebrow">QINGJIAN · FRONTEND PREVIEW</text><text class="q-title">{{article.title}}</text><view v-for="section in article.sections" :key="section.title" class="q-card q-content-card"><text class="q-row-title">{{section.title}}</text><text>{{section.text}}</text></view></template>
   <template v-else-if="mode==='downloads'"><text class="q-title">留下每次准备的足迹。</text><text class="q-description">以下仅为本机模拟记录，不代表真实文件已生成。</text><view v-if="!state.exports.length" class="q-empty q-card"><AppIcon name="download" :size="36"/><text class="q-row-title">还没有下载记录</text><text class="q-small">先预览简历，再体验下载流程。</text><button role="button" class="q-text-button" @click="go('preview')">去看看简历 →</button></view><view v-for="record in state.exports" :key="record.id" class="q-card q-content-card"><view class="q-between"><text class="q-row-title">{{record.title}}</text><text class="q-badge">模拟完成</text></view><text class="q-small">{{record.type}} · {{date(record.time)}}</text><text class="q-small">未生成真实文件，无需查找下载目录。</text></view></template>
   <template v-else>
    <text class="eyebrow">FRONTEND TEST LAB</text><text class="q-title">放心试，每个状态都可达。</text><view class="q-note"><AppIcon name="help" :size="20"/><text>不连接后端，不登录或付款。切换的模拟状态会影响会员、AI 和下载演示。</text></view>
    <view class="q-card q-content-card"><text class="q-row-title">模拟服务结果</text><view class="q-test-scenarios"><button role="button" v-for="item in [{id:'success',name:'正常完成'},{id:'error',name:'服务错误'},{id:'quota',name:'下载额度用完'}]" :key="item.id" :class="{active:state.simulation===item.id}" @click="state.simulation=item.id as typeof state.simulation;persist()">{{item.name}}</button></view></view>
    <view class="q-card q-menu"><button role="button" @click="add(false)"><text>创建空白简历</text><AppIcon name="plus" :size="18"/></button><button role="button" @click="add(true)"><text>创建示例简历</text><AppIcon name="plus" :size="18"/></button><button role="button" @click="longSample"><text>创建长内容与多经历样例</text><AppIcon name="plus" :size="18"/></button></view>
    <view class="q-card q-menu"><button role="button" v-for="item in testRoutes.slice(0,-1)" :key="item.route" @click="go(item.route)"><text>{{item.label}}</text><AppIcon name="arrow" :size="16"/></button></view><text class="q-endnote">先验证填写与预览，再检查异常、取消和重复操作。</text>
   </template>
  </view></scroll-view>
  <template v-if="mode==='drafts'" #footer><ActionButton label="+ 新建空白简历" @click="add(false)"/></template>
 </AppFrame>
</template>
