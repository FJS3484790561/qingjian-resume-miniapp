<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import HomeView from './HomeView.vue'
import TemplatesView from './TemplatesView.vue'
import EditorView from './EditorView.vue'
import DraftFields from './DraftFields.vue'
import ResumePaper from './ResumePaper.vue'
import AppIcon from './AppIcon.vue'
import ActionButton from './ActionButton.vue'
import { contactErrors, readDraft, sectionLabels, templates, type Draft, type Screen, type Section, type Variant } from '../data/prototype'

const props = withDefaults(defineProps<{ variant: Variant; initialScreen?: Screen }>(), { initialScreen: 'home' })
const draft = reactive(readDraft(props.variant))
const screen = ref<Screen>(props.initialScreen)
const step = ref(0)
const busy = ref(false)
const saved = ref(false)
const dirty = ref(false)
const showErrors = ref(false)
const editSection = ref<Section | null>(null)
const editBuffer = reactive<Draft>({ ...draft })
const sheetOpen = ref(false)
const warningOpen = ref(false)
const infoOpen = ref(false)
const infoTitle = ref('')
const infoText = ref('')
const profileOpen = ref(false)
const toast = ref('')
const toastError = ref(false)
const reduced = ref(Boolean(uni.getStorageSync('qingjian-prototype:reduced-motion')))
const keyboardOpen = ref(false)
const statusTop = ref(24)
let active = true
let operation = 0
let toastTimer: ReturnType<typeof setTimeout> | undefined
const title = computed(() => ({ home: '轻简履', templates: '简历样式', editor: '编辑简历', preview: '我的简历' }[screen.value]))
const selected = computed(() => templates.find(t => t.id === draft.templateId) || templates[0])
const themeColor = computed(() => ({ fern: '#346C57', paper: '#525C78', sky: '#4864A6' }[props.variant]))

watch(() => props.initialScreen, value => { screen.value = value })
watch(sheetOpen, value => { if (!value) { operation++; busy.value = false } })

function notify(message: string, error = false) {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = message
  toastError.value = error
  toastTimer = setTimeout(() => { if (active) toast.value = '' }, 2800)
}
function change(key: keyof Draft, value: string) { draft[key] = value; dirty.value = true; saved.value = false }
function changeBuffer(key: keyof Draft, value: string) { editBuffer[key] = value }
function navigate(next: Screen) {
  operation++; busy.value = false; screen.value = next; showErrors.value = false
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}
function back() { navigate(screen.value === 'preview' ? 'editor' : 'home') }
function chooseTemplate(id: string) { change('templateId', id) }
function homeTemplate(id: string) { chooseTemplate(id); navigate('templates') }
function openSection(section: Section) {
  Object.assign(editBuffer, draft); editSection.value = section; showErrors.value = false; sheetOpen.value = true
}
function valid(data: Draft) {
  const errors = contactErrors(data)
  showErrors.value = true
  if (errors.phone || errors.email) { notify('请先检查联系方式的格式', true); return false }
  return true
}
async function save(fromSheet = false) {
  if (busy.value) return
  const data = fromSheet ? { ...editBuffer } : { ...draft }
  if (!valid(data)) return
  busy.value = true
  const id = ++operation
  await new Promise(resolve => setTimeout(resolve, 650))
  if (!active || id !== operation) return
  try {
    uni.setStorageSync(`qingjian-prototype:${props.variant}`, data)
    Object.assign(draft, data)
    saved.value = true; dirty.value = false; busy.value = false
    if (fromSheet) sheetOpen.value = false
    notify('草稿已保存在本机')
  } catch {
    busy.value = false
    notify('保存未成功，内容仍保留在页面，请重试', true)
  }
}
function requestPreview() {
  if (busy.value) return
  if (!valid(draft)) {
    if (props.variant === 'fern') openSection('basic')
    if (props.variant === 'sky') step.value = 0
    showErrors.value = true
    return
  }
  if (!draft.name.trim()) { warningOpen.value = true; return }
  void generatePreview()
}
async function generatePreview() {
  warningOpen.value = false
  busy.value = true
  const id = ++operation
  await new Promise(resolve => setTimeout(resolve, 800))
  if (!active || id !== operation) return
  busy.value = false; screen.value = 'preview'
  notify('预览已更新，示例内容仅用于方案体验')
}
function nextStep() {
  if (step.value === 0 && !valid(draft)) return
  step.value = Math.min(2, step.value + 1)
}
function showTool(name: string) {
  infoTitle.value = name
  infoText.value = name === '更多简历模块'
    ? '完整版本将包含教育、在校、实习、工作、项目、技能、证书、爱好、自评、报考、自荐信及自定义模块。本轮先体验基本信息、经历和求职意向。'
    : name === '下载文档'
      ? '当前为视觉与交互原型，可以编辑、保存本机草稿和预览排版。真实文件导出将在方案选定后的功能开发阶段接入。'
      : `${name}已列入完整功能清单。本轮方案重点展示首页、模板选择与简历编辑流程，暂未实现此功能。`
  infoOpen.value = true
}
function review() { uni.reLaunch({ url: '/pages/review/index' }) }
const keyboardHandler = (result: { height: number }) => { keyboardOpen.value = result.height > 0 }
onMounted(() => {
  const info = uni.getSystemInfoSync()
  statusTop.value = info.statusBarHeight || 24
  // #ifdef MP-WEIXIN
  const capsule = uni.getMenuButtonBoundingClientRect()
  if (capsule.top) statusTop.value = Math.max(info.statusBarHeight || 20, capsule.top - 6)
  // #endif
  if (typeof uni.onKeyboardHeightChange === 'function') uni.onKeyboardHeightChange(keyboardHandler)
})
onBeforeUnmount(() => {
  active = false; operation++
  if (toastTimer) clearTimeout(toastTimer)
  if (typeof uni.offKeyboardHeightChange === 'function') uni.offKeyboardHeightChange(keyboardHandler)
})
</script>
<template>
  <view class="prototype" :class="['theme-' + variant, { 'reduced-motion': reduced, 'keyboard-open': keyboardOpen }]">
    <view class="top-chrome" :style="{ paddingTop: statusTop + 'px' }">
      <!-- #ifdef H5 -->
      <view class="sim-status"><text>9:41</text><view class="status-right"><view class="signal-bars"><view /><view /><view /><view /></view><text>●</text><view class="status-battery"><view /></view></view></view>
      <!-- #endif -->
      <view class="app-navbar">
        <button role="button" v-if="screen !== 'home'" class="nav-back icon-button" aria-label="返回" @click="back"><AppIcon name="back" :size="21" /></button>
        <view v-else class="brand-lockup"><view class="brand-symbol"><view /><view /></view><text>{{ variant === 'paper' ? '轻 简 履' : '轻简履' }}</text></view>
        <text v-if="screen !== 'home'" class="nav-title">{{ title }}</text>
        <text v-if="screen === 'home' && variant === 'paper'" class="brand-edition">简历编辑室</text>
        <!-- #ifdef H5 -->
        <view class="sim-capsule" aria-label="微信胶囊占位"><text>•••</text><view /><text class="capsule-circle">◉</text></view>
        <!-- #endif -->
      </view>
    </view>

    <scroll-view class="scene-scroll" scroll-y :show-scrollbar="false" :key="screen + '-' + (variant === 'sky' ? step : '')">
      <HomeView v-if="screen === 'home'" :variant="variant" :draft="draft" :saved="saved" @edit="navigate('editor')" @templates="navigate('templates')" @tool="showTool" @template="homeTemplate" />
      <TemplatesView v-else-if="screen === 'templates'" :variant="variant" :selected="draft.templateId" @select="chooseTemplate" @use="navigate('editor')" />
      <EditorView v-else-if="screen === 'editor'" :variant="variant" :draft="draft" :step="step" :show-errors="showErrors" @change="change" @edit-section="openSection" @step="step = $event" @blur="showErrors = true" @tool="showTool" />
      <view v-else class="preview-content"><view class="preview-heading"><view><text class="eyebrow">你写的内容，正在发光</text><text class="page-title">这就是你的下一程。</text></view><text class="sample-label">示例预览</text></view><view class="document-preview"><ResumePaper :draft="draft" :large="true" /></view><view class="preview-style-row"><view><text class="muted">当前样式</text><text class="preview-template-name">{{ selected.name }}</text></view><button role="button" class="text-link" @click="navigate('templates')">更换样式 <AppIcon name="arrow" :size="16" /></button></view><text class="preview-disclaimer">示例数据；预览用于比较视觉与操作体验。</text></view>
      <view class="content-tail" />
    </scroll-view>

    <view v-if="screen === 'home'" class="bottom-nav"><button role="button" class="bottom-nav-item active" @click="navigate('home')"><AppIcon name="home" :size="23" /><text>首页</text></button><button role="button" class="bottom-nav-item" @click="profileOpen = true"><AppIcon name="user" :size="23" /><text>我的</text></button></view>
    <view v-else-if="screen === 'templates'" class="bottom-action"><view class="selection-summary"><text class="muted">已选样式</text><text>{{ selected.name }}</text></view><ActionButton label="用这个样式" arrow @click="navigate('editor')" /></view>
    <view v-else-if="screen === 'editor'" class="bottom-action editor-bottom"><template v-if="variant === 'sky'"><button role="button" v-if="step > 0" class="secondary-step" @click="step--">上一步</button><button role="button" v-else class="secondary-step" :disabled="busy" @click="save()">保存草稿</button><ActionButton :label="busy ? '正在排版' : step < 2 ? '下一步' : '生成简历'" :loading="busy" arrow @click="step < 2 ? nextStep() : requestPreview()" /></template><template v-else><button role="button" class="save-draft-button" :disabled="busy" @click="save()"><AppIcon v-if="!busy" :name="saved && !dirty ? 'check' : 'file'" :size="19" /><text>{{ busy ? '处理中' : saved && !dirty ? '已保存' : '保存草稿' }}</text></button><ActionButton :label="busy ? '正在排版' : variant === 'paper' ? '预览这份简历' : '生成简历'" :loading="busy" arrow @click="requestPreview" /></template></view>
    <view v-else class="bottom-action"><button role="button" class="secondary-step" @click="navigate('editor')">继续编辑</button><ActionButton label="下载文档" @click="showTool('下载文档')" /></view>

    <view v-if="toast" class="app-toast" :class="{ 'toast-error': toastError }" role="status"><AppIcon :name="toastError ? 'help' : 'check'" :size="18" /><text>{{ toast }}</text></view>

    <wd-popup v-model="sheetOpen" position="bottom" :duration="reduced ? 0 : 220" :close-on-click-modal="!busy" :safe-area-inset-bottom="true" custom-class="studio-popup">
      <view class="edit-sheet"><view class="sheet-handle" /><view class="sheet-heading"><view><text class="eyebrow">写下属于你的内容</text><text class="sheet-title">{{ editSection ? sectionLabels[editSection] : '' }}</text></view><button role="button" class="icon-button" :disabled="busy" aria-label="取消编辑" @click="sheetOpen = false"><AppIcon name="close" :size="21" /></button></view><scroll-view scroll-y class="sheet-form-scroll"><DraftFields v-if="editSection" :draft="editBuffer" :section="editSection" :show-errors="showErrors" @change="changeBuffer" @blur="showErrors = true" /></scroll-view><view class="sheet-actions"><button role="button" class="sheet-cancel" :disabled="busy" @click="sheetOpen = false">取消</button><ActionButton :label="busy ? '保存中' : '保存这一部分'" :loading="busy" @click="save(true)" /></view></view>
    </wd-popup>
    <wd-popup v-model="warningOpen" position="bottom" :duration="reduced ? 0 : 180" :safe-area-inset-bottom="true" custom-class="studio-popup"><view class="notice-sheet"><view class="sheet-handle" /><text class="sheet-title">简历还差一个名字</text><text class="notice-body">姓名等基本信息尚未填写，预览内容可能不完整。你可以先看看样式，再回来继续完善。</text><ActionButton label="返回补充" @click="warningOpen = false; variant === 'fern' ? openSection('basic') : (step = 0)" /><button role="button" class="notice-secondary" @click="generatePreview">仍要预览</button></view></wd-popup>
    <wd-popup v-model="infoOpen" position="bottom" :duration="reduced ? 0 : 180" :safe-area-inset-bottom="true" custom-class="studio-popup"><view class="notice-sheet"><view class="sheet-handle" /><text class="eyebrow">本轮方案体验范围</text><text class="sheet-title">{{ infoTitle }}</text><text class="notice-body">{{ infoText }}</text><ActionButton label="知道了" @click="infoOpen = false" /></view></wd-popup>
    <wd-popup v-model="profileOpen" position="bottom" :duration="reduced ? 0 : 180" :safe-area-inset-bottom="true" custom-class="studio-popup"><view class="notice-sheet"><view class="sheet-handle" /><text class="sheet-title">我的创作</text><button role="button" class="profile-draft pressable" @click="profileOpen = false; navigate('editor')"><view class="avatar-dot">{{ draft.name.slice(0, 1) || '简' }}</view><view><text class="draft-title">{{ draft.name || '我' }}的求职简历</text><text class="draft-meta">示例草稿 · {{ saved ? '已保存到本机' : '继续完善' }}</text></view><AppIcon name="arrow" :size="20" /></button><button role="button" class="notice-secondary" @click="profileOpen = false; review()">回到三套方案对比</button></view></wd-popup>
  </view>
</template>
