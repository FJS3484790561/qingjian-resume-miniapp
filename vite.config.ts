import { defineConfig,loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import publicApi from './config/public-api.json'

function apiAddress(mode:string) {
  const value=(loadEnv(mode,process.cwd(),'VITE_').VITE_API_BASE_URL||(mode==='production'?publicApi.productionBaseUrl:publicApi.developmentBaseUrl)).replace(/\/$/,'')
  const url=new URL(value)
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('VITE_API_BASE_URL 必须为 HTTPS 地址或本机 HTTP 联调地址，不得包含凭据、查询参数或片段')
  return value
}
export default defineConfig(({mode})=>({
  plugins: [uni()],
  define:{__QINGYU_API_BASE__:JSON.stringify(apiAddress(mode))},
  css: { preprocessorOptions: { scss: { silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions'] } } }
}))
