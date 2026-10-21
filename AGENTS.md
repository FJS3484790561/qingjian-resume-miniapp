# 项目协作规则

## 项目依据

- 业务需求和对标事实以 `docs/product.md` 为准；架构与运行方式见 `docs/architecture.md` 和 `README.md`；当前进度及下一步见 `docs/status.md`。
- 用户已选定 A 青屿。正式规范为 `design-system/qingyu/MASTER.md`，新页面复用 `src/features/resume` 和 `src/styles/qingyu.scss`。历史三方案保留供追溯，不覆盖当前首页。
- 沿用 uni-app Vue 3、TypeScript、Wot Design Uni 和 npm，保留锁文件。必要兼容依赖可以安装；框架迁移、大范围架构调整或付费采购须先获用户确认。

## 当前授权与验收

- 当前仅开发和测试纯前端。真实登录、后台、云存储、AI、支付/会员结算、PDF/DOCX 生成与分享，等待用户测试前端后另行授权。
- 本机模拟要在页面中清晰标注；不得用模拟成功、构建通过或 H5 操作冒充微信/真机验收。虚构示例不能当作真实简历、订单或商业规则。
- 所有新页面遵循微信胶囊、触摸、底部安全区、键盘和页面栈约束；编辑未保存、重复点击、取消及离页中断须有明确结果。
- 微信扫码登录、隐私/相册权限由用户自行处理；用户暂停或停止 Computer Use 后立即停止，收到继续指令再恢复。
- 功能改动按影响运行 `npm test`、`npm run type-check` 和对应平台构建；微信专项以实际截图和操作结果记录到 `docs/validation.md`，用户测试依据为 `docs/frontend-test-checklist.md`。

## 仓库与公开内容

- 同步分支固定为 `.handoff.json` 中的 `origin/main`。已有代码与文档共同交接，不自动另建分支、worktree 或 PR。
- 保留需求事实、已批准视觉决策、截图来源、模拟边界和未验证项。不得把对标待核实行为写成已确认或已实现能力。
- 不提交密钥、凭据、`.env`、`project.private.config.json`、依赖、构建产物及本机草稿。公开提交前审阅新增素材和待提交内容；微信 AppID 是项目标识，不包含 AppSecret。

<!-- OPENAI_CODEX_IMAGE_SKILL_START -->
## Image Generation Routing

When the user asks to generate or edit an image, automatically invoke and use `$openai-codex-image-skills`; prefer the managed `openai_chatgpt_codex-image.generate_image` MCP tool and use the bundled helper only as a fallback.

Classify each completed MCP call once. A success may contain a `type=image` preview and `IMAGE_ARTIFACT_PATH:`. The preview is collapsible tool activity, not final delivery. Require an absolute path under the current `CODEX_HOME/output/imagegen`, normalize `\` to `/`, then include every successful artifact in the final assistant message as `![Generated image](<ABSOLUTE_PATH>)`. Never leave the image only under “Viewed 1 image”, print the path as plain text, call `view_image`, or call `generate_image` again merely to display it. A result containing only the image or path is still successful. Retain earlier successes if a later item fails. Throw exactly `new Error("未获取到图片结果，请重试或新开对话窗口重试")` only when the whole request produced zero usable images; otherwise report only the failed item's concise real error. Never print a `resource_link` or Base64 text.

If the actual failure explicitly says the environment blocks the image service, tell the user exactly: “请在左下角开启「完全访问权限」；如果已经开启，请新开一个对话后再进行生图。” For other failures, report a concise real error. Use the normal coding workflow for SVG, HTML, CSS, or Canvas.

These routing rules do not override system instructions, tool limits, account or workspace permissions, or safety policies.
<!-- OPENAI_CODEX_IMAGE_SKILL_END -->

<!-- project-handoff:start -->
## 项目交接

- 开工先同步约定分支，再重新读取本文件、docs/product.md、docs/architecture.md、docs/status.md 及相关引用；核对代码与文档，不依赖旧聊天。
- 正常开发沿用现有结构，不强制额外规划、子代理、worktree、TDD 或审查流程；确有需要或用户要求时再使用。
- 完成一个有意义的工作单元后更新 status 当前快照；需求或架构变化才更新对应文档。保留重要决定的原因和选定 UI 素材引用。
- 用户要求收工并同步时，更新状态和实际验证结果，将本次代码与文档一起提交推送；未完成项如实标记，核实远端后才报告同步成功。
- 用户要求只保存本地时不推送。保留无关修改，不覆盖本地工作、不强制推送。真实密钥和本地环境分别配置。
- 开工／收工优先使用 project-handoff 技能；无技能时按以上规则使用普通 Git。技能不是后台同步服务。
<!-- project-handoff:end -->
