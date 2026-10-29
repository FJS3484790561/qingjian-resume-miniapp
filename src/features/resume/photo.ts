import { photoSpecs } from './schema'

export function photoSpec(selected?: string) {
  const index = Number(selected ?? 0)
  return photoSpecs[Number.isInteger(index) && index >= 0 && index < photoSpecs.length ? index : 0]
}

export function photoPlacement(sourceWidth: number, sourceHeight: number, width: number, height: number, scale: number, x: number, y: number) {
  if (![sourceWidth, sourceHeight, width, height].every(n => Number.isFinite(n) && n > 0)) throw new Error('照片尺寸无效，请重新选择')
  const zoom = Math.max(100, Math.min(200, Number.isFinite(scale) ? scale : 100)) / 100
  const fit = Math.max(width / sourceWidth, height / sourceHeight) * zoom
  const w = sourceWidth * fit, h = sourceHeight * fit
  return { width: w, height: h, x: (width - w) / 2 + Math.max(-50, Math.min(50, x || 0)) / 100 * width, y: (height - h) / 2 + Math.max(-50, Math.min(50, y || 0)) / 100 * height }
}

export function photoError(error: unknown, action: 'choose' | 'read' | 'generate' | 'apply' | 'album') {
  const reason = String((error as { errMsg?: string })?.errMsg || (error as Error)?.message || '')
  if (/cancel/i.test(reason)) return action === 'choose' ? '已取消选图，原有照片和取景仍保留。' : '已取消保存，生成图片仍保留。'
  if (/auth|deny|denied|permission/i.test(reason)) return '相册权限未允许。请自行在微信权限设置中检查，回来后可重试；也可以使用示例头像。'
  if (action === 'choose') return '选图未完成，原有照片仍保留。请重试，或使用示例头像。'
  if (action === 'read') return '照片读取失败，请重新选择本机照片。'
  if (action === 'apply') return '本机照片保存未完成，简历原有照片未变。请重试。'
  if (action === 'album') return '相册保存未完成，生成图片仍保留。请检查权限和空间后重试。'
  return '图片生成失败，取景设置仍保留。请重试。'
}

// #ifdef H5
// Object URLs expire when the tab closes. Store selected local images as data URLs.
export async function localPhotoDataUrl(path: string): Promise<string> {
  if (path.startsWith('data:image/')) return path
  const response = await fetch(path)
  if (!response.ok) throw new Error('照片读取失败')
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('照片读取失败'))
    reader.onerror = () => reject(new Error('照片读取失败'))
    reader.readAsDataURL(blob)
  })
}
// #endif
