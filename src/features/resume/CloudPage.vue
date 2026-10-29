<script setup lang="ts">
import { computed,ref,watch } from 'vue'
import { onShow,onHide,onUnload } from '@dcloudio/uni-app'
import AppFrame from './AppFrame.vue'
import ActionButton from '../../components/ActionButton.vue'
import { account,apiBase,getService,login,logout,deleteAccount,getBackups,getBackup,putBackup,deleteBackup,snapshotForServer,hydrateServerResume,sameSession,getPhotos,deletePhoto,type PrivatePhoto,type BackupMeta } from './backend'
import { currentResume,state,clone,backupBinding,saveBackupBinding,importBackup,message,storageStatus } from './store'
import { makeResume } from './schema'
import { go } from './navigation'
const busy=ref(false),error=ref(''),feedback=ref('')
const service=ref<Awaited<ReturnType<typeof getService>>|null>(null)
const rows=ref<BackupMeta[]>([])
const photos=ref<PrivatePhoto[]>([])
const confirming=ref(false)
watch(()=>account.session?.token,()=>{rows.value=[];photos.value=[];error.value='';feedback.value=''}, {flush:'sync'})
let visibility=0
onHide(()=>{visibility++})
onUnload(()=>{visibility++})
const binding=computed(()=>account.session?backupBinding(currentResume.value.id,account.session.user.id):undefined)
const localServer=computed(()=>account.session?.user.provider==='development')
const accountLabel=computed(()=>localServer.value?'本机开发测试账号':'微信账号')
async function action(work:()=>Promise<void>){if(busy.value)return;busy.value=true;error.value='';feedback.value='';try{await work()}catch(e){error.value=String((e as {message?:string})?.message||'操作未完成，请重试')}finally{busy.value=false}}
async function refreshRows(){const token=account.session?.token;if(token){const [backups,assets]=await Promise.all([getBackups(),getPhotos()]);sameSession(token);rows.value=backups.resumes;photos.value=assets.photos}else{rows.value=[];photos.value=[]}}
function refresh(){return action(async()=>{service.value=await getService();await refreshRows()})}
onShow(()=>{void refresh()})
function signIn(provider:'wechat'|'development'){return action(async()=>{await login(provider);await refreshRows();feedback.value=provider==='development'?'开发测试账号已连接，备份写入本机后端数据库。':'微信账号已登录。尚未上传本机简历。'})}
function signOut(){return action(async()=>{await logout();rows.value=[];photos.value=[];feedback.value='已退出，服务端会话已失效。本机简历与服务端备份均保留。'})}
function upload(copy=false){return action(async()=>{
 if(storageStatus.blocked)throw new Error('请先恢复本机存储，当前未上传任何内容')
 const session=account.session;if(!session)throw new Error('请先登录')
 const localId=currentResume.value.id
 const bound=copy?undefined:backupBinding(localId,session.user.id)
 const snapshot=await snapshotForServer(clone(currentResume.value),session.token)
 snapshot.id=bound?.remoteId||makeResume().id
 sameSession(session.token)
 const result=await putBackup(snapshot,bound?.revision||0)
 sameSession(session.token)
 if(!saveBackupBinding(localId,{userId:session.user.id,remoteId:result.id,revision:result.revision})){
  await refreshRows();throw new Error('服务端已保存，但本机未能记录关联。请从备份列表导入这份内容后再更新，避免重复备份。')
 }
 feedback.value='已保存到'+(localServer.value?'本机后端数据库':'服务端')+'，版本 '+result.revision+'。'+(snapshot.basic.photoId?'已包含私有照片。':'本份简历没有照片。')+'备份为点击时已保存的内容。'
 await refreshRows()
})}
function restore(row:BackupMeta){return action(async()=>{
 const session=account.session,user=session?.user;if(!session||!user)throw new Error('请先登录')
 const active=visibility,localId=currentResume.value.id
 const data=await getBackup(row.id)
 const restored=await hydrateServerResume(data.resume,session.token)
 if(active!==visibility||currentResume.value.id!==localId){feedback.value='页面或当前草稿已变化，本次未导入；原有草稿保留。';return}
 if(!importBackup(restored,{userId:user.id,remoteId:data.id,revision:data.revision}))throw new Error('本机保存失败，未导入或覆盖原简历，请重试')
 feedback.value='已导入为新的本机简历，原草稿保留。可以返回继续编辑。'
})}
function confirmMutation(title:string,content:string,confirmText:string,work:()=>Promise<void>){
 if(busy.value||confirming.value)return
 const token=account.session?.token,active=visibility
 confirming.value=true
 uni.showModal({title,content,confirmText,confirmColor:'#b2413e',success:r=>{confirming.value=false;if(r.confirm)void action(async()=>{sameSession(token);if(active!==visibility)throw new Error('页面已变化，未执行删除；请重新确认');await work()})},fail:()=>{confirming.value=false;error.value='确认窗口未能打开，请重试'}})
}
function confirmDelete(row:BackupMeta){confirmMutation('删除这份服务端备份？','仅删除「'+row.title+'」的服务端内容，本机草稿保留。删除无法撤销。','删除备份',async()=>{await deleteBackup(row.id,row.revision);await refreshRows();feedback.value='服务端备份已删除，本机简历保留。'})}
function destroy(){confirmMutation('删除账号及全部服务端数据？','账号下全部备份、私有照片、生成文件、AI 任务和登录会话将被删除，无法恢复。本机草稿保留。','删除账号',async()=>{await deleteAccount();rows.value=[];photos.value=[];feedback.value='账号及全部服务端数据已删除，本机草稿保留。'})}
function beforeBack(){if(busy.value){message('请求处理中，请稍候；已发出的保存请求可能在服务端完成');return false}return true}
function date(time:number){return new Date(time).toLocaleString('zh-CN')}
function removePhoto(photo:PrivatePhoto){confirmMutation('删除这张服务端照片？','不会删除本机照片。被备份或生成任务使用的照片不能删除；删除后无法恢复。','删除照片',async()=>{await deletePhoto(photo.id);await refreshRows();feedback.value='服务端照片已删除，本机照片保留。'})}
</script>
<template>
 <AppFrame title="账号与简历备份" :before-back="beforeBack">
  <scroll-view scroll-y class="q-scroll"><view class="q-page q-cloud-page" :aria-busy="busy">
   <text class="eyebrow">KEEP EVERY CHAPTER.</text><text class="q-title">认真写下，妥善留存。</text>
   <view class="q-note"><text>手动备份已保存的文字、模块、排版和照片。照片会上传到当前账号的私有存储。导入会新建草稿，离页则取消导入。保存请求发出后离页仍可能在服务端完成，请回来刷新核实。</text></view>
   <view v-if="error" id="cloud-error" class="q-error-summary" role="alert"><text>{{error}}</text></view>
   <view v-if="feedback" class="q-note" role="status" aria-live="polite"><text>{{feedback}}</text></view>
   <view class="q-card q-content-card">
    <text class="q-row-title">{{account.session?accountLabel:'连接账号'}}</text>
    <text v-if="account.session" class="q-small">账号 {{account.session.user.id.slice(0,8)}} · {{localServer?'仅本机联调，不是微信身份':'服务端已验证微信身份'}}</text>
    <text v-else class="q-small">登录后主动点击备份才上传内容，不会自动迁移本机草稿。</text>
    <text v-if="service?.developmentLogin" class="q-small q-api-address">本机联调地址：{{apiBase}}</text>
    <text v-if="!service" class="q-small">{{busy?'正在连接服务…':'未连接到服务，可检查后重试。'}}</text>
    <template v-if="!account.session&&service">
     <!-- #ifdef MP-WEIXIN -->
     <ActionButton v-if="service.wechatLogin" id="cloud-wechat-login" label="微信登录" :loading="busy" @click="signIn('wechat')"/>
     <!-- #endif -->
     <text v-if="!service.wechatLogin" class="q-small">微信登录尚未配置。开发测试账号仅用于本机联调。</text>
     <ActionButton v-if="service.developmentLogin" id="cloud-dev-login" label="连接本机开发测试账号" :loading="busy" @click="signIn('development')"/>
     <text v-if="service.developmentLogin" class="q-small">测试账号绑定当前设备，仅用于本机开发联调。</text>
    </template>
    <button id="cloud-refresh" class="q-outline-button" :disabled="busy" @click="refresh">{{busy?'请求处理中…':'刷新连接与备份列表'}}</button>
    <button v-if="account.session" id="cloud-logout" class="q-text-button" :disabled="busy" @click="signOut">退出登录（保留简历）</button>
   </view>
   <template v-if="account.session">
    <view class="q-card q-content-card"><text class="q-row-title">备份当前简历</text><text>{{currentResume.title}}</text><text class="q-small">本机共 {{state.resumes.length}} 份 · {{binding?'已关联备份，当前基准版本 '+binding.revision:'尚未关联服务端备份'}}</text>
     <ActionButton id="cloud-upload" :label="binding?'更新当前备份（含已选照片）':'备份当前简历（含已选照片）'" :loading="busy" :disabled="storageStatus.blocked" @click="upload(false)"/>
     <button v-if="binding" id="cloud-copy" class="q-outline-button" :disabled="busy||storageStatus.blocked" @click="upload(true)">另存为新的服务端副本</button>
    </view>
    <view class="q-section-head"><text>{{localServer?'本机服务端':'服务端'}}备份 · {{rows.length}} / 100</text></view>
    <view v-if="!rows.length" class="q-card q-empty"><text class="q-row-title">还没有服务端备份</text><text class="q-small">点击上方备份按钮，保存当前简历。</text></view>
    <view v-for="row in rows" :key="row.id" class="q-card q-content-card"><text class="q-row-title">{{row.title}}</text><text class="q-small">版本 {{row.revision}} · {{date(row.updatedAt)}}</text><view class="q-inline-actions"><button :id="'cloud-restore-'+row.id" class="q-outline-button" :disabled="busy||storageStatus.blocked" @click="restore(row)">导入为新草稿</button><button class="q-danger-text q-text-button" :disabled="busy" @click="confirmDelete(row)">删除备份</button></view></view>
    <view class="q-card q-content-card"><text class="q-row-title">私有照片 · {{photos.length}} / 30</text><text class="q-small">备份和导出会按内容去重上传照片。未使用的照片可单独删除。</text><view v-for="photo in photos" :key="photo.id" class="q-between"><text class="q-small">{{photo.width}} × {{photo.height}} · {{date(photo.createdAt)}}</text><button class="q-text-button q-danger-text" :disabled="busy" @click="removePhoto(photo)">删除照片</button></view></view>
    <button id="cloud-delete-account" class="q-danger-text q-outline-button" :disabled="busy" @click="destroy">删除账号及全部服务端备份</button>
    <button class="q-text-button" :disabled="busy" @click="go('workspace')">继续编辑当前简历 →</button>
   </template>
   <text class="q-endnote">真实 PDF / Word 可从简历预览的下载入口生成。AI 服务暂未启用；会员支付仍为模拟，不产生交易。</text>
  </view></scroll-view>
 </AppFrame>
</template>
<style scoped>
.q-cloud-page .q-content-card{gap:20rpx}.q-api-address{overflow-wrap:anywhere;word-break:break-all}
.q-cloud-page button[disabled]{opacity:.55}.q-cloud-page .q-outline-button{min-height:48px}
</style>
