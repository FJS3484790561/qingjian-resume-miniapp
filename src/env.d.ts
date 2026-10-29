/// <reference types="vite/client" />
declare const __QINGYU_API_BASE__: string
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
