# 技术方案 · 青屿纯前端

更新：2026-10-21。AppID `wxdccead0ec32190d0`，版本 0.2.0。用户选择青屿，保留已有技术栈，不迁移框架。

## 技术与依赖

- uni-app Vue 3 + TypeScript，首要目标微信小程序，同源 H5 用于辅助检查。
- uni 系列 `3.0.0-5020620260917001`；Vue/runtime-core 3.5.44；Wot Design Uni 1.14.0；TypeScript 5.9.3；vue-tsc 3.3.13；Sass 1.105.2；Vite 5.4.21。
- npm 官方源，提交形态包含 package-lock.json；uni 插件使用同主版本 Vite override。
- Wot 支持 Vue 3、微信/H5 与 CSS 变量定制，MIT。继续用于按钮、图标、弹层；表单、文档、导航与照片组件由项目统一封装。没有引入网页专用动画或新的正式依赖。
- 使用原生 uni editor、picker、canvas 与相册 API。系统中文字体、代码排版模板和轻量过渡。H5 胶囊为模拟占位，微信端根据真实胶囊计算导航高度。

## 组织

- `src/pages/app`：home/profile/workspace/module/entries/manage/preview/templates/photos/photo-editor/word/word-detail/membership/help/settings/article/ai/download/downloads/testing/drafts，共 21 路由。
- `src/features/resume/schema.ts`：字段、16 模块、校验、排序、虚构样例。
- `store.ts`：响应式多草稿与本机数据，存储键 `qingyu-frontend:v1`。保存失败保留当前表单。
- `document.ts` 与 `ResumeDocument.vue`：完整数据渲染、模块顺序/隐藏、长文本分块与估算分页，非真实 PDF 引擎。
- 页面组件覆盖填写、预览、资源库、个人中心、模拟流程和本机照片处理。
- `src/styles/qingyu.scss`：批准的青屿外观；`design-system/qingyu/MASTER.md`：规范来源。共享 foundation 在 tokens.scss。
- `src/pages/review/fern/paper/sky`：仅保留历史候选，不再控制新页面。
- `scripts/test-resume.cjs`：实际 schema/document 逻辑的 Node 测试，无额外测试框架。

## 交互与数据

表单采用局部缓冲，保存再合并；取消不写入。自定义返回会检查未保存内容。重复提交通过 loading 锁阻止；页面隐藏/卸载取消异步演示，避免过期跳转与模拟记录。导航深度接近微信上限时替换当前页。

证件照可选本机图片或代码绘制示例，通过 canvas 生成指定像素 PNG；微信端保存为本机文件用于简历，不上传人像。底色不替代抠图。相册授权由用户自行处理。

会员、下载和 AI 分别有明确模拟文案及错误状态；不使用网络请求、云服务或真实订单。AI 演示只按原文分句整理；下载只记录模拟完成，没有 PDF/DOCX 文件。示例套餐不代表正式定价，期限与次数没有服务端结算。

## 验证边界

构建目录 `dist/build/mp-weixin`，官方 CLI 可打开项目。已在微信模拟器实际观察青屿首页，其他原生流程尚待用户测试；具体结果与 H5 分开记录，见 [validation.md](validation.md)。不上传/发布。

微信 WXSS 不支持通配符选择器：`prefers-reduced-motion` 的通配符和 `focus-visible` 样式限定为 H5，青屿公共样式使用明确的元素选择器。`pages.json` 已移除微信不识别的 rpxCalc 配置。首页编译阻断已修复；历史 ResumePaper 的标签选择器与 `getSystemInfoSync` 弃用警告仍需后续处理。

现有构建链审计遗留见验证文档，未以强制升级或降级改变技术架构。

## 代码与文档交接

公开仓库：<https://github.com/FJS3484790561/qingjian-resume-miniapp>。`.handoff.json` 固定 `origin/main`；项目原无 Git 历史，启用交接时初始化为 main。代码、npm 锁文件、需求事实、青屿规范、实际截图与验证记录一并版本管理。

`AGENTS.md` 保存项目规则，`docs/product.md` 是业务入口，本文是技术入口，`docs/status.md` 是当前快照，不重复生成另一套权威文档。启动和导入步骤见 README；换电脑需要重新安装 Node/npm、依赖与微信开发者工具并自行登录。`dist`、`node_modules`、本机体验数据和凭据不随 Git 同步。
