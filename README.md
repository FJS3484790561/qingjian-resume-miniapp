# 轻简履 · 青屿

个人简历微信小程序。用户已选定 A 青屿：清新淡雅、鼠尾草绿、留白与分模块编辑。前端阶段 1—4 已完成开发与模拟器回归，账号备份、私有照片与真实文件导出已部署到独立 HTTPS 后端。

公开仓库：[FJS3484790561/qingjian-resume-miniapp](https://github.com/FJS3484790561/qingjian-resume-miniapp)。交接分支固定为 `origin/main`，规则见 [AGENTS.md](AGENTS.md)，当前快照见 [docs/status.md](docs/status.md)。

## 在微信开发者工具中测试

**2026-10-29 公网 HTTPS 联调入口：**运行 `npm run wechat:open`；重新构建用 `npm run wechat:open -- -Build`。默认 API 为 `https://resume.roomai.top`，request/downloadFile 合法域名已在正确微信账号保存。脚本核对实际构建地址、AppID 和生产健康状态，开启域名校验并打开工具；不依赖 SSH 或本机后端，不清草稿。HTTPS 就绪不代表真机或上线验收完成。

AppID：`wxdccead0ec32190d0`。技术栈保留 uni-app Vue 3 + TypeScript + Wot Design Uni，包管理器 npm。

本机已验证环境：Node.js 22.12.0、npm 10.9.0。按锁文件安装。纯本机编辑不需密钥；账号备份联调先启动本机 API，微信正式登录再配置服务端密钥。

```powershell
npm ci
npm run build:mp-weixin
```

导入目录：项目内的 `dist/build/mp-weixin`（不是源码根目录）。当前电脑为 `D:\gpt项目\简历小程序\dist\build\mp-weixin`。

本机新版工具可这样打开：

```powershell
& 'D:\微信web开发者工具\cli.bat' open --project 'D:\gpt项目\简历小程序\dist\build\mp-weixin'
```

持续开发可运行 `npm run dev:mp-weixin`，在工具中导入 `dist/dev/mp-weixin`。构建版和开发版不要混用路径。微信扫码登录、相册权限由用户自行处理。

首页或“我的”底部可进入前端测试台，切换正常、错误、额度用完，创建空白、示例及长内容草稿。可单独重置模拟会员，保留简历和记录。第三、第四阶段开发与回归记录见验证文档；真机交互待用户验收。


反复覆盖构建后若发现页面数据错位，先在工具中清理**编译缓存**并重开项目；不要清理全部缓存或 storage，以免删除本机草稿。本机 CLI：

```powershell
& 'D:\微信web开发者工具\cli.bat' cache --project 'D:\gpt项目\简历小程序\dist\build\mp-weixin' --clean compile
& 'D:\微信web开发者工具\cli.bat' close --project 'D:\gpt项目\简历小程序\dist\build\mp-weixin'
& 'D:\微信web开发者工具\cli.bat' open --project 'D:\gpt项目\简历小程序\dist\build\mp-weixin'
```

可选微信集成脚本 `scripts/wechat-smoke.cjs` 需本机官方 `miniprogram-automator` SDK 与已启用的自动化端口，普通前端开发/用户验收不需要安装它。示例（SDK 路径用本机实际位置）：

```powershell
$env:QINGYU_AUTOMATOR_MODULE='C:\实际临时目录\node_modules\miniprogram-automator'
& 'D:\微信web开发者工具\cli.bat' auto --project 'D:\gpt项目\简历小程序\dist\build\mp-weixin' --auto-port 9420 --trust-project
node scripts/wechat-smoke.cjs
```

脚本新增独立虚构样例和本机模拟记录，切换测试场景并重置模拟会员，不清空已有草稿；不上传、不发布、不支付。`--core-only` 和 `--auxiliary-only` 可分别运行核心与辅助流程。机器报告与真实截图保存在 `docs/previews/qingyu`，不能替代真机权限/键盘验收。

## 当前能力与模拟边界

- 22 个页面路由，16 类简历模块、基本信息、多条经历、富文本、模块管理、排序和多草稿。
- 6 款代码排版示例模板、封面、8 色、三项各五档排版、重命名和全文预览。
- 6 种证件照规格、本机选图/示例、取景缩放、画布底色、生成真实本机 PNG、应用到简历。
- WORD 模板列表/详情、会员、AI 整理、下载及记录均可测试页面交互。
- PDF/DOCX 真实生成与账号下载记录；保留独立标注的模拟下载入口。会员仍为本机模拟；AI 已有可配置接口，供应商尚未选择，未配置不会调用模型，可独立切本机演示。证件照不含抠图、换装和美颜。
- 日常编辑先存本机；「我的 → 账号与简历备份」可主动备份文字、排版和已选照片到后端，导入为新草稿。照片和文件按账号私有保存。
- 当前开发者工具直接通过 HTTPS 连接指定服务器的真实微信身份与私有存储，已完成微信 code2session/备份/照片/真实文档联调。手机网络、权限和原生文档查看器待实际验收；首次使用虚构示例，可新建空白草稿。

## 启动本机后端

```powershell
npm ci
npx playwright install chromium
npm run server:dev
```

服务地址为 <http://127.0.0.1:8787>。保持终端运行后，在微信模拟器进入 **我的 → 账号与简历备份 → 连接本机开发测试账号**，即可测试真实数据库备份和恢复。开发者工具本地 HTTP 联调需关闭本项目的合法域名校验；仅改本地调试配置。真机需正式 HTTPS 与微信合法域名。

`.env.example` 提供本机变量模板。独立本机联调须明确将 `VITE_API_BASE_URL` 设置为回环地址再重建；生产默认地址来自 `config/public-api.json`，本机 `.env` 的显式覆盖优先。微信正式登录的 AppSecret 只放本机 `.env` 或部署平台的服务端秘密配置，不发到聊天或提交 Git。`npm run server:start` 默认关闭开发登录；数据库在忽略目录 `server/data`，不会随源码同步。Node 22.12.0 内置 SQLite 仍有实验提示，服务器已在 Node 22.23.2 验证。

文件引擎需额外安装上方 Chromium。PDF 使用服务端独立无头浏览器；不会操作你的浏览器。Word 由 OOXML 生成，分页可能随查看软件和字体变化。`server/data` 中的数据库含照片与文件，需要单独备份，不随 Git。可用 `npm run test:render` 对隔离虚构样例执行真实引擎检查，产物在忽略目录 `server/data/qa`。

完整步骤、接口、限制与后续阶段见 [后端开发与验收](docs/backend.md)。验证命令：

```powershell
npm run test:server
npm run server:type-check
```

## 浏览器辅助体验与验证

```powershell
npm run dev
npm test
npm run type-check
npm run build:h5
npm run build:mp-weixin
```

[打开青屿](http://127.0.0.1:5173/#/)。历史三方案保留在 `/#/pages/review/index`，不再是项目首页。

浏览器实测和编译通过不能替代微信模拟器、真机与相册权限验收。

## 换电脑恢复与收工

首次在新电脑克隆：

```powershell
git clone https://github.com/FJS3484790561/qingjian-resume-miniapp.git
cd qingjian-resume-miniapp
```

安装 project-handoff 技能后，在项目根目录使用技能的 `start` 同步 `origin/main`；已有本地修改时先保留并核对，不重置或强制覆盖。默认安装位置示例：

```powershell
python "$env:USERPROFILE/.codex/skills/project-handoff/scripts/handoff.py" start --project .
npm ci
npm run build:mp-weixin
```

技能若安装在其他位置，替换脚本路径。同步后重新阅读 AGENTS、需求、架构和进度，再继续工作；用户只要求读取进度时使用 `inspect`，不拉取。收工按技能更新 status，使用明确文件清单执行 `finish` 提交并推送，核实远端后报告结果。

Git 只同步源码、锁文件、规范和交接资料，不同步依赖、构建目录、微信工具登录态或 `qingyu-frontend:v1` 本机草稿。新电脑需分别配置后端环境与数据库；AppID 是公开标识，不能在仓库加入 AppSecret、数据库或其他凭据。

## 文档

- [后端开发、运行与验收](docs/backend.md)

- [分阶段开发与验收（阶段 3、4 集中验收）](docs/development-phases.md)
- [前端测试清单](docs/frontend-test-checklist.md)
- [当前验证记录](docs/validation.md)
- [青屿正式设计规范](design-system/qingyu/MASTER.md)
- [需求和对标事实](docs/product.md)
- [架构与数据边界](docs/architecture.md)
- [进度交接](docs/status.md)
- [历史三方案依据](docs/design-proposals.md)


## AI 与独立部署

AI 可配置接口已实现，服务商/模型由用户稍后指定；未配置时明确禁用。填写 `.env.example` 中 AI 四项仅限服务端，不能将密钥放入 VITE_ 或聊天。AI 页面为 `/#/pages/app/ai`；登录后主动同意才发送选中正文与模块名，不发送整份简历或照片。真实 AI 质量、微信页面和真机还未验收，当前自动测试使用隔离响应。

目标腾讯云服务器已有其他服务，本项目使用独立 8790 回环端口、systemd 服务、数据目录和 `resume.roomai.top` Nginx 虚拟主机。单独的 Let's Encrypt 证书及续期 hook 已配置；原站与另外两个服务回归正常。步骤、回滚方式与未验收项见 [部署记录](docs/deployment.md)。

```powershell
npm run server:build
npm run test:bundle
```

实际服务端产物为 `dist/server/index.cjs`，运行依赖按 package-lock 在 Linux 安装；不能复制本机 node_modules。当前 AppID 固定 `wxdccead0ec32190d0`，对应公众平台原始账号 `gh_be04da2f9958`。服务端会拒绝其他小程序的 AppID。
