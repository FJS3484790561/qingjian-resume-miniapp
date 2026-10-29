const { test } = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./resume-test-harness.cjs')
const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v))
function setup() {
  const disk = new Map(), pending = []
  let localFailure = false
  const h = harness('CloudPage', {}, {
    getStorageSync: key => copy(disk.get(key)),
    setStorageSync: (key,value) => { if(localFailure && key==='qingyu-frontend:v1')throw Error('quota'); disk.set(key,copy(value)) },
    removeStorageSync: key => disk.delete(key),
    request: options => { pending.push(options) }
  })
  const api = h.load('backend')
  api.account.session = { token:'a'.repeat(64),expiresAt:Date.now()+100000,user:{id:'test-user',provider:'development'} }
  return {h,api,pending,disk,failLocal:value=>{localFailure=value},
    reply(statusCode,data) { const options=pending.shift();assert.ok(options,'expected pending request');options.success({statusCode,data}) }
  }
}
const tick = async() => {for(let n=0;n<12;n++)await Promise.resolve()}

test('backup uploads a private photo reference and saved snapshot once, keeping later local edits',async()=>{
  const s=setup(),{h}=s
  try{
    h.store.updateResume(r=>{r.basic.photo='data:image/png;base64,dGVzdA=='})
    const id=h.store.currentResume.value.id
    const operation=h.screen.upload();h.screen.upload()
    assert.equal(s.pending.length,1)
    assert.equal(s.pending[0].url.endsWith('/v1/photos'),true)
    h.store.updateResume(r=>{r.title='用户在请求期间修改的标题'})
    s.reply(200,{id:'private-photo',width:295,height:413});await tick()
    const sent=s.pending[0].data.resume
    assert.equal('photo' in sent.basic,false)
    assert.equal(s.pending[0].data.expectedRevision,0)
    assert.equal(sent.basic.photoId,'private-photo')
    assert.notEqual(sent.title,h.store.currentResume.value.title)
    s.reply(200,{id:sent.id,title:sent.title,revision:1,updatedAt:Date.now()});await tick()
    s.reply(200,{resumes:[]});s.reply(200,{photos:[]});await operation
    assert.equal(h.store.currentResume.value.id,id)
    assert.equal(h.store.currentResume.value.basic.photo,'data:image/png;base64,dGVzdA==')
    assert.equal(h.store.currentResume.value.title,'用户在请求期间修改的标题')
    assert.equal(h.store.backupBinding(id,'test-user').revision,1)
    assert.match(h.screen.feedback.value,/已包含私有照片/)
  }finally{h.dispose()}
})

test('version conflicts and offline failures keep the local draft and original backup revision',async()=>{
  const s=setup(),{h}=s
  try{
    const id=h.store.currentResume.value.id
    h.store.saveBackupBinding(id,{userId:'test-user',remoteId:'server-resume',revision:2})
    const before=JSON.stringify(h.store.state)
    const operation=h.screen.upload()
    await tick()
    assert.equal(s.pending[0].data.expectedRevision,2)
    s.reply(409,{error:{code:'VERSION_CONFLICT',message:'服务端版本已变化'}});await operation
    assert.equal(JSON.stringify(h.store.state),before)
    assert.match(h.screen.error.value,/服务端版本已变化/)
    assert.equal(h.screen.busy.value,false)
    const offline=h.screen.upload();await tick();s.pending.shift().fail({});await offline
    assert.equal(JSON.stringify(h.store.state),before)
    assert.equal(s.api.account.session.user.id,'test-user')
  }finally{h.dispose()}
})

test('restore saves a new local copy, retains previous drafts and refuses to import when storage fails',async()=>{
  const s=setup(),{h}=s
  try{
    const original=h.store.currentResume.value.id
    const remote=copy(h.store.currentResume.value);remote.id='remote-resume';remote.title='服务端内容'
    s.failLocal(true)
    const failed=h.screen.restore({id:'remote-resume'});s.reply(200,{id:remote.id,revision:3,resume:remote});await failed
    assert.equal(h.store.state.resumes.length,1);assert.equal(h.store.currentResume.value.id,original)
    s.failLocal(false)
    const restored=h.screen.restore({id:'remote-resume'});h.screen.restore({id:'remote-resume'})
    assert.equal(s.pending.length,1)
    s.reply(200,{id:remote.id,revision:3,resume:remote});await restored
    assert.equal(h.store.state.resumes.length,2);assert.notEqual(h.store.currentResume.value.id,original)
    assert.notEqual(h.store.currentResume.value.id,'remote-resume')
    assert.ok(h.store.state.resumes.some(r=>r.id===original))
    assert.equal(h.store.backupBinding(h.store.currentResume.value.id,'test-user').revision,3)
    assert.equal(h.store.backupBinding(h.store.currentResume.value.id,'different-user'),undefined)
  }finally{h.dispose()}
})

test('a late 401 does not clear a newer session, while current-session expiry does',async()=>{
  const s=setup(),{h,api}=s
  try{
    const old=api.getBackups().catch(e=>e)
    api.account.session={...api.account.session,token:'b'.repeat(64)}
    s.reply(401,{error:{code:'SESSION_EXPIRED',message:'登录过期'}});await old
    assert.equal(api.account.session.token,'b'.repeat(64))
    const current=api.getBackups().catch(e=>e)
    s.reply(401,{error:{code:'SESSION_EXPIRED',message:'登录过期'}});await current
    assert.equal(api.account.session,null)
  }finally{h.dispose()}
})

test('leaving during restore cannot switch the current draft when the late response arrives',async()=>{
  const s=setup(),{h}=s
  try{
    const before=JSON.stringify(h.store.state),remote=copy(h.store.currentResume.value)
    const restoring=h.screen.restore({id:'remote-resume'})
    h.fire('hide')
    s.reply(200,{id:'remote-resume',revision:1,resume:remote});await restoring
    assert.equal(JSON.stringify(h.store.state),before)
    assert.match(h.screen.feedback.value,/未导入/)
  }finally{h.dispose()}
})

test('failed logout preserves the session and server deletion must be explicitly confirmed',async()=>{
  const s=setup(),{h,api}=s
  try{
    const failure=api.logout().catch(e=>e);s.pending.shift().fail({});await failure
    assert.ok(api.account.session)
    h.screen.confirmDelete({id:'server-copy',title:'我的简历',revision:3})
    assert.equal(s.pending.length,0)
    h.modals.at(-1).success({confirm:false});assert.equal(s.pending.length,0)
    h.screen.destroy();h.modals.at(-1).success({confirm:false});assert.equal(s.pending.length,0)
    const logout=api.logout();assert.deepEqual(copy(s.pending[0].data),{});s.reply(200,{ok:true});await logout
    assert.equal(api.account.session,null)
    assert.equal(h.store.state.resumes.length,1)
  }finally{h.dispose()}
})

test('logout and expired sessions immediately clear private backup and photo views',async()=>{
  const s=setup(),{h,api}=s
  try{
    h.screen.rows.value=[{id:'private-backup'}];h.screen.photos.value=[{id:'private-photo'}]
    const out=h.screen.signOut();s.reply(200,{ok:true});await out
    assert.equal(api.account.session,null)
    assert.equal(h.screen.rows.value.length,0);assert.equal(h.screen.photos.value.length,0)
    api.account.session={token:'b'.repeat(64),expiresAt:Date.now()+100000,user:{id:'new-user',provider:'wechat'}}
    h.screen.rows.value=[{id:'other-backup'}];h.screen.photos.value=[{id:'other-photo'}]
    const expired=api.getBackups().catch(e=>e)
    s.reply(401,{error:{code:'SESSION_EXPIRED',message:'登录已失效'}});await expired
    assert.equal(h.screen.rows.value.length,0);assert.equal(h.screen.photos.value.length,0)
  }finally{h.dispose()}
})

test('old delete confirmations cannot act on a changed account or a hidden page',async()=>{
  const s=setup(),{h,api}=s
  try{
    h.screen.confirmDelete({id:'old-backup',title:'原账号备份',revision:1})
    api.account.session={...api.account.session,token:'b'.repeat(64),user:{id:'new-user',provider:'wechat'}}
    h.modals.at(-1).success({confirm:true});await tick()
    assert.equal(s.pending.length,0);assert.match(h.screen.error.value,/账号已变化/)
    h.screen.destroy();h.fire('hide');h.modals.at(-1).success({confirm:true});await tick()
    assert.equal(s.pending.length,0);assert.match(h.screen.error.value,/页面已变化/)
    assert.equal(h.store.state.resumes.length,1)
  }finally{h.dispose()}
})

test('repeated destructive taps open one confirmation and cancellation sends no request',()=>{
  const s=setup(),{h}=s
  try{
    h.screen.destroy();h.screen.destroy();h.screen.removePhoto({id:'private-photo'})
    assert.equal(h.modals.length,1)
    h.modals[0].success({confirm:false})
    assert.equal(s.pending.length,0)
    h.screen.removePhoto({id:'private-photo'});assert.equal(h.modals.length,2)
  }finally{h.dispose()}
})
