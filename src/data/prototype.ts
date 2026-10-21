export type Variant = 'fern' | 'paper' | 'sky'
export type Screen = 'home' | 'templates' | 'editor' | 'preview'
export type Section = 'basic' | 'experience' | 'intention'

export interface Draft {
  name: string
  role: string
  phone: string
  email: string
  city: string
  school: string
  major: string
  educationTime: string
  experience: string
  skills: string
  salary: string
  templateId: string
}

// All résumé content is fictional demonstration data; no production endpoint is used.
export const sampleDraft: Draft = {
  name: '林知夏',
  role: '产品设计师',
  phone: '13800000000',
  email: 'zhixia@example.com',
  city: '杭州',
  school: '南方设计学院',
  major: '工业设计 · 本科',
  educationTime: '2022.09 — 2026.06',
  experience: '校园生活服务平台｜产品设计\n参与 8 场用户访谈，梳理预约服务的关键路径，完成 12 个核心页面设计，让操作更清晰、便捷。',
  skills: 'Figma、交互设计、用户研究、原型制作',
  salary: '面议',
  templateId: 'clear'
}

export const directions = [
  { id: 'fern' as Variant, letter: 'A', name: '青屿', subtitle: '轻盈、有序、有呼吸感', description: '鼠尾草绿与柔和卡片，以模块为单位轻松编辑。', color: '#346C57', tag: '推荐方案', layout: '轻盈卡片 · 模块编辑', tradeoff: '亲和、易上手；单屏信息量较少。' },
  { id: 'paper' as Variant, letter: 'B', name: '素笺', subtitle: '像编辑一份好作品', description: '暖白纸张、宋体标题与细线，呈现安静的编辑秩序。', color: '#525C78', tag: '编辑美学', layout: '杂志编排 · 连续编辑', tradeoff: '文档感与识别度强；长表单需要滚动。' },
  { id: 'sky' as Variant, letter: 'C', name: '晴空', subtitle: '每一步，都离机会更近', description: '雾蓝色工作台与分步任务，把简历制作拆成小目标。', color: '#4864A6', tag: '流程引导', layout: '轻量工作台 · 分步编辑', tradeoff: '步骤明确；熟练用户跨步编辑略多一次点击。' }
]

export const templates = [
  { id: 'clear', name: '清晰边界', category: '简约', description: '清楚的层次，让每段经历都有重点', layout: 'clean', color: '#416D5B', label: '清晰 · 通用' },
  { id: 'space', name: '留白之间', category: '简约', description: '适度留白，留给内容更多表达空间', layout: 'editorial', color: '#666C7B', label: '留白 · 轻盈' },
  { id: 'order', name: '秩序之美', category: '商务', description: '经典侧栏，快速呈现职业与能力', layout: 'sidebar', color: '#456587', label: '专业 · 稳重' },
  { id: 'first', name: '初见', category: '应届生', description: '突出教育与项目，认真展示第一份积累', layout: 'clean', color: '#9A6D57', label: '校园 · 清新' },
  { id: 'idea', name: '一页灵感', category: '应届生', description: '灵活的分区，为项目作品保留位置', layout: 'editorial', color: '#5B7086', label: '设计 · 创意' },
  { id: 'story', name: '简约叙事', category: '商务', description: '精炼的单栏，完整讲述你的成长', layout: 'clean', color: '#71638A', label: '叙事 · 干练' }
]

export const filters = ['全部', '简约', '商务', '应届生']
export const sectionLabels: Record<Section, string> = { basic: '基本信息', experience: '经历与能力', intention: '求职意向' }

export function readDraft(variant: Variant): Draft {
  const value = uni.getStorageSync(`qingjian-prototype:${variant}`)
  const draft = { ...sampleDraft }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(draft) as (keyof Draft)[]) {
      if (typeof value[key] === 'string') draft[key] = value[key]
    }
  }
  if (!templates.some(t => t.id === draft.templateId)) draft.templateId = 'clear'
  return draft
}

export function contactErrors(draft: Draft) {
  return {
    phone: draft.phone && !/^1\d{10}$/.test(draft.phone) ? '请输入 11 位手机号码，或暂时留空' : '',
    email: draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) ? '邮箱格式不正确，例如 name@example.com' : ''
  }
}
