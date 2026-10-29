# 技术方案 · 青屿前后端

更新：2026-10-29。AppID `wxdccead0ec32190d0`，版本 0.4.0。用户选择青屿，保留已有技术栈，不迁移框架。当前实际部署见 [deployment.md](deployment.md)，各日期实现记录按历史范围阅读。

## 技术与依赖

- uni-app Vue 3 + TypeScript，首要目标微信小程序，同源 H5 用于辅助检查。
- uni 系列 `3.0.0-5020620260917001`；Vue/runtime-core 3.5.44；Wot Design Uni 1.14.0；TypeScript 5.9.3；vue-tsc 3.3.13；Sass 1.105.2；Vite 5.4.21。2026-10-29 修正 `@dcloudio/types` 为 uni-app peer 所需的 3.4.31，根锁文件保留，干净安装 dry-run 通过。
- npm 官方源，提交形态包含 package-lock.json；uni 插件使用同主版本 Vite override。
- Wot 支持 Vue 3、微信/H5 与 CSS 变量定制，MIT。继续用于按钮、图标、弹层；表单、文档、导航与照片组件由项目统一封装。没有引入网页专用动画。后端文件引擎的独立依赖见下文。
- 使用原生 uni editor、picker、canvas 与相册 API。系统中文字体、代码排版模板和轻量过渡。H5 胶囊为模拟占位，微信端根据真实胶囊计算导航高度。

## 组织

- `src/pages/app`：home/profile/workspace/module/entries/manage/preview/templates/photos/photo-editor/word/word-detail/membership/help/settings/article/ai/download/downloads/testing/drafts，新增 cloud，共 22 路由。
- `src/features/resume/schema.ts`：字段、16 模块、校验、排序、虚构样例。
- `store.ts`：响应式多草稿与本机数据，存储键 `qingyu-frontend:v1`。所有变更通过 `updateState` 克隆并先写入本机，成功后才更新响应式状态；保存失败保留原数据和当前表单。
- `document.ts` 与 `ResumeDocument.vue`：完整数据渲染、模块顺序/隐藏、长文本分块与估算分页，非真实 PDF 引擎。
- 页面组件覆盖填写、预览、资源库、个人中心、模拟流程和本机照片处理。
- `src/styles/qingyu.scss`：批准的青屿外观；`design-system/qingyu/MASTER.md`：规范来源。共享 foundation 在 tokens.scss。
- `src/pages/review/fern/paper/sky`：仅保留历史候选，不再控制新页面。
- `photo.ts`：六规格校验、裁剪计算、错误分类和 H5 本机图片 dataURL 转换。照片操作用 token 与草稿/原照片快照，防止陈旧回调覆盖。
- `scripts/test-resume.cjs`：实际 schema/document/store 测试；`resume-test-harness.cjs` 编译实际 SFC setup，注入隔离 uni API 和可控时钟；交互、备份、文件及 AI 客户端共 57 项回归，无新增测试框架。
- `scripts/wechat-smoke.cjs`：可选官方微信自动化集成。通过现有自动化端口连接本机已打开项目，不 mock API、不注入业务状态、不清用户存储；全量或 `--core-only` / `--auxiliary-only`，报告和截图写入 docs/previews/qingyu。SDK 使用环境变量指定的临时安装位置。

## 交互与数据

表单采用局部缓冲，保存再合并；取消不写入。自定义返回会检查未保存内容。重复提交通过 loading 锁阻止；页面隐藏/卸载取消异步演示，避免过期跳转与模拟记录。导航深度接近微信上限时替换当前页。

模块管理及预览弹层接入页面返回钩子；重命名关闭/遮罩退出先确认未保存名称。`useUnsavedGuard.ts` 对微信端按脏状态启用原生页面返回询问，并在隐藏/卸载及明确保存/放弃时解除；H5 仍使用 `onBackPress` 与页面内返回。微信该 API 不覆盖手势滑动返回或退出小程序，保持为单独验收限制。

草稿创建、切换、删除、重置以及体验设置和模拟记录共用同一存储事务。删除非当前草稿不改变当前选择，删除最后一份时创建可编辑空白。读入数据先校验字段、模块顺序、唯一 ID 和排版档位；读取失败或结构损坏时保留磁盘原数据，以明显标记的临时示例展示并阻止普通写入。用户可重试读取，成功后回首页，避免旧表单缓冲写入新读入的草稿；只有设置中明确确认清空才允许覆盖恢复。

证件照可选本机图片或代码绘制示例，通过 canvas 生成指定像素 PNG；微信端保存为本机文件用于简历，仅在主动备份或导出时上传所选照片；H5 基本信息照片转为 dataURL，避免关闭后临时地址失效。生成看门狗 15 秒，超时解锁；隐藏/卸载使旧回调失效。底色不替代抠图，相册授权由用户自行处理。

会员套餐、下载标题/类型与 AI 原文均在操作开始时快照，取消/隐藏/卸载不留下过期成功；AI 应用/撤销需核对原记录和当前正文，重新整理/切换先处理未应用结果。会员未确认时滚动到说明，不让错误停在屏外。AI 已接可配置后端但尚未配置供应商，会员仍模拟；下载默认使用真实文件服务并保留独立模拟入口。账号与备份通过 backend.ts 连接服务端。AI 演示只按原文分句整理，模拟下载只记录本机完成；真实文件与记录来自独立后端接口。示例套餐不代表正式定价，期限与次数没有服务端结算。

## 验证边界

构建目录 `dist/build/mp-weixin`，官方 CLI 可打开项目。已在微信模拟器通过官方 SDK 执行 21 路由渲染与照片、AI、下载等实际操作，真机仍待用户测试；具体结果与 H5 分开记录，见 [validation.md](validation.md)。不上传/发布。

微信 WXSS 不支持通配符选择器：`prefers-reduced-motion` 的通配符和 `focus-visible` 样式限定为 H5，青屿公共样式使用明确的元素选择器。`pages.json` 已移除微信不识别的 rpxCalc 配置。首页编译阻断与 ResumePaper scoped 标签选择器已修正；AppFrame 改用 getWindowInfo 并按实际胶囊位置预留空间。微信 CLI/依赖自身仍可能产生弃用或预加载提示，不把无运行异常写成零警告。

小程序插槽与自定义组件会保留包装层，底栏通过 slot 内明确的 q-footer-row / q-footer-primary 实现 Flex，不跨层依赖虚拟宿主。覆盖构建目录后若工具混用旧 JS 与新 WXML，清理 compile 缓存并关闭/重开项目，保留 storage。

现有构建链审计遗留见验证文档，未以强制升级或降级改变技术架构。

## 后端与备份（2026-10-24 新增）

用户明确授权后端开发。本轮新增独立 Fastify 5.12.7 + TypeScript API，继续用现有 npm/锁文件，不迁移前端。插件 @fastify/cors 11.3.1、@fastify/rate-limit 11.2.1 与 Fastify 5 兼容；Zod 4.6.7 做服务端校验，sanitize-html 2.18.1 做受限富文本清理。以上运行依赖及 tsx 4.23.15 均为 MIT；类型依赖只在开发检查使用。前端构建不导入这些 Node 依赖。

- `server/config.ts`：环境变量与开发登录限制；`.env.example` 仅变量模板。AppSecret 只给服务端；前端只注入公开 API 地址。
- `server/database.ts`：Node 内置 node:sqlite，WAL、外键与事务迁移 v3；数据库保存在忽略目录 server/data，不随 Git。Node 22.12.0 运行需 experimental-sqlite flag，当前先作本机单实例后端，不宣称生产就绪。
- `server/auth.ts`：官方微信 code2session、随机会话、哈希与过期。开发登录显式启用且只允许回环地址；正式微信缺配置返回 503，不回落开发身份。
- `server/app.ts`：健康、会话、个人账号、简历列表/全文/更新/删除，全部业务操作从会话读取归属。正文最大 512 KiB、有效备份最多 100；SQL 参数化、限流、CORS、统一无敏感错误响应。
- `server/validation.ts`：读取现有 schema 字段定义，独立验证并清理富文本。不接受客户端会员/归属字段，也不接受照片路径，只接受本账号私有 photoId 引用。
- `src/features/resume/backend.ts`：uni.request、登录存储、会话过期与超时；POST 空操作明确发送 `{}`，避免微信空 JSON 被拒绝。API 只接受 HTTPS 或本机 HTTP 配置。
- `CloudPage.vue` / `pages/app/cloud.vue`：我的 → 账号与简历备份。本机编辑保留，用户主动备份才发请求；导入另建草稿，不覆盖原本机内容。storage 中可选 backups 元数据按账号和本机 ID 保存关联及基准版本，旧 v1 本机数据仍兼容。
- 更新采用 expectedRevision 事务检查；过期返回 409，不自动采用刚拉取的版本覆盖。删除清空内容并留 ID 墓碑，延迟请求不能复活旧数据；账号删除级联清除全部备份与会话。

启动、环境变量、完整接口、数据边界和验收见 [backend.md](backend.md)。照片/文件本机实现见下文；AI、支付和部署逐期接入，保持现有辅助流程的模拟标识。未配置真实密钥、未部署公网或发布小程序。

## 代码与文档交接

公开仓库：<https://github.com/FJS3484790561/qingjian-resume-miniapp>。`.handoff.json` 固定 `origin/main`；项目原无 Git 历史，启用交接时初始化为 main。代码、npm 锁文件、需求事实、青屿规范、实际截图与验证记录一并版本管理。

`AGENTS.md` 保存项目规则，`docs/product.md` 是业务入口，本文是技术入口，`docs/status.md` 是当前快照，不重复生成另一套权威文档。启动和导入步骤见 README；换电脑需要重新安装 Node/npm、依赖与微信开发者工具并自行登录。`dist`、`node_modules`、本机体验数据和凭据不随 Git 同步。

## 私有照片与文件服务（2026-10-24，0.4.0）

- `server/files.ts` 注册照片和导出接口；SQLite v3 增加 photos / exports。规范化照片和完成文件保存在 BLOB，账号外键级联删除；路径不来自用户。当前按本机单进程单实例运行，无公网对象存储或生产备份承诺。
- 照片只接收 PNG/JPEG/WebP base64，原图不超过 4 MB、静态解码不超过 1600 万像素；sharp 0.35.5 校验、按方向旋转、限制输出尺寸并剥离元数据。按账号和内容去重，最多 30 张/20 MB；备份和进行中任务引用的照片不能删除。
- 导出保存快照、requestId 和摘要，重试同一输入不重复建任务；不同输入复用请求 ID 返回冲突。单 worker 排队、45 秒上限、取消和账号删除胜过迟到结果；重启把中断任务标记失败。最多 50 条有效记录、文件合计 50 MB、单文件 10 MB；上限是技术保护而非商业额度。
- `server/render.ts`：Playwright 1.64.1 独立 Chromium 输出 A4 PDF，禁用脚本和所有外部资源请求；本地字体与内嵌照片。`docx` 9.14.0 + htmlparser2 12.0.0 生成可编辑段落/强调/列表/图片。Word 的结构、封面与版式为原生文档表达，不承诺与 PDF 逐像素一致。Playwright/sharp 为 Apache-2.0，docx/htmlparser2 为 MIT，支持当前 Node。
- `src/data/templateCatalog.ts` 抽出与平台无关的模板定义，前后端共享；`documentBlocks(resume,false)` 保留完整富文本，服务端不使用预览的估算分页。
- `backend.ts` 在主动备份/导出时转成本账号私有 photoId，导入先还原 dataURL，再原子保存为新草稿。异步跨账号停止，读取或保存失败不覆盖原草稿。
- `RealExportPage.vue` 为下载默认入口，真实状态轮询，明确准备/排队/完成/失败/取消；取消使旧轮询失效，换草稿/账号清理旧任务视图。`ExportHistory.vue` 与原模拟记录分开。H5 鉴权获取 Blob 触发下载；微信用 downloadFile 请求头和 openDocument，不把令牌放到 URL。
- 二进制下载仍要求会话、no-store；没有公共照片/文件 URL。账号删除同时移除照片、文件、备份和会话。生产加密、保留期、容量和备份恢复另行落实。


## 可配置 AI 与部署准备（2026-10-25）

`server/ai.ts` 提供 OpenAI 兼容 Chat Completions 适配（配置后才启用）、私有异步任务与用量聚合；`database.ts` 事务迁移到 v4。单 worker/有界队列、幂等、取消/超时/重启和账号删除保护不依赖前端模拟。输入/结果清理、供应商同意和技术上限见 [backend.md](backend.md)。模型服务商未选择，没有真实上游验收。

`AiPage.vue` 默认显示真实服务配置状态，未配置时禁用，保留独立演示；`backend.ts` 负责任务 API，不向前端注入密钥。结果手改/应用/撤销复用本机草稿存储，检查原文与账号；异步旧回调不能写入新草稿。

`npm run server:build` 使用 esbuild 0.28.2（MIT，Node >=18）打包纯业务源码到 CJS，Node 运行依赖 external，保持 npm 锁文件。使用 CJS 避免当前 Node 22.12 上 sanitize-html / htmlparser2 组合在 ESM 导入图中的循环加载问题；实际产物由 test:bundle 隔离启动验证，不把编译成功代替启动。

2026-10-25 当时仅准备部署；2026-10-29 已在目标机部署 8790 回环/专用账号/独立数据目录，完成 Linux Chromium/字体和真实微信文件闭环。未迁移框架或引入 Docker。当前详见 [deployment.md](deployment.md)。

## 公网 HTTPS 接入（2026-10-29）

`微信客户端 → https://resume.roomai.top:443 → 独立 Nginx 虚拟主机 → 127.0.0.1:8790 → qingyu-api → 私有 SQLite v4 / 文件引擎`。主域及其他项目服务独立。证书覆盖 resume 子域，ACME webroot 与 Nginx reload hook 支持续期。

`TRUST_LOCAL_PROXY=true` 时仅信任本机回环代理；Nginx 用实际 `$remote_addr` 覆盖客户端 X-Forwarded-For，按实际来源限流，外部伪造代理头无效。默认关闭代理信任；后端 23 项测试包含隔离来源及伪造头回归。

`config/public-api.json` 保存公开的生产/开发默认地址。Vite 根据 mode 选择，`VITE_API_BASE_URL` 显式覆盖仍优先；只把公开地址注入前端。`wechat:open` 读取实际构建包：HTTPS 分支开启合法域名校验，历史 SSH 回环分支仅用于显式本机调试。两者均核对固定 AppID，不回落模拟身份。
