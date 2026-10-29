export type Route='home'|'profile'|'workspace'|'module'|'entries'|'manage'|'preview'|'templates'|'photos'|'photo-editor'|'word'|'word-detail'|'membership'|'help'|'settings'|'article'|'ai'|'download'|'downloads'|'testing'|'drafts'|'cloud'
let navigating=false
const complete=()=>{navigating=false}
const fail=()=>{navigating=false;uni.showToast({title:'页面打开未完成，请重试',icon:'none'})}
export function go(route:Route,params:Record<string,string>={}) {
 if(navigating)return false
 navigating=true
 const query=Object.entries(params).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
 const options={url:`/pages/app/${route}${query?'?'+query:''}`,complete,fail}
 if(route==='home'||route==='profile')uni.reLaunch(options)
 else if(getCurrentPages().length>=9)uni.redirectTo(options)
 else uni.navigateTo(options)
 return true
}
export function back() {if(navigating)return false;if(getCurrentPages().length<=1)return go('home');navigating=true;uni.navigateBack({complete,fail});return true}
