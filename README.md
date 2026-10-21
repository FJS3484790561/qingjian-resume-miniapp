# 轻简履 · 青屿前端测试版

个人简历微信小程序。用户已选定 A 青屿：清新淡雅、鼠尾草绿、留白与分模块编辑。当前交付完整前端测试流程，后端由用户完成前端测试后另行授权。

公开仓库：[FJS3484790561/qingjian-resume-miniapp](https://github.com/FJS3484790561/qingjian-resume-miniapp)。交接分支固定为 `origin/main`，规则见 [AGENTS.md](AGENTS.md)，当前快照见 [docs/status.md](docs/status.md)。

## 在微信开发者工具中测试

AppID：`wxdccead0ec32190d0`。技术栈保留 uni-app Vue 3 + TypeScript + Wot Design Uni，包管理器 npm。

本机已验证环境：Node.js 22.12.0、npm 10.9.0。按锁文件安装；无需配置服务端密钥。

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

首页或“我的”底部可进入前端测试台，切换正常、错误、额度用完，创建空白、示例及长内容草稿。

## 当前能力与模拟边界

- 21 个页面路由，16 类简历模块、基本信息、多条经历、富文本、模块管理、排序和多草稿。
- 6 款代码排版示例模板、封面、8 色、三项各五档排版、重命名和全文预览。
- 6 种证件照规格、本机选图/示例、取景缩放、画布底色、生成真实本机 PNG、应用到简历。
- WORD 模板列表/详情、会员、AI 整理、下载及记录均可测试页面交互。
- 会员、AI、文档下载为明确标注的本机模拟；不会付款、调用 AI 或生成 PDF/DOCX。证件照不含抠图、换装和美颜。
- 数据仅在当前设备存储；没有账号、后台、云同步或生产数据写入。首次使用虚构示例，可新建空白草稿。

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

Git 只同步源码、锁文件、规范和交接资料，不同步依赖、构建目录、微信工具登录态或 `qingyu-frontend:v1` 本机草稿。当前前端不需要服务端环境变量；AppID 是公开标识，不能在仓库加入 AppSecret 或其他凭据。

## 文档

- [前端测试清单](docs/frontend-test-checklist.md)
- [当前验证记录](docs/validation.md)
- [青屿正式设计规范](design-system/qingyu/MASTER.md)
- [需求和对标事实](docs/product.md)
- [架构与数据边界](docs/architecture.md)
- [进度交接](docs/status.md)
- [历史三方案依据](docs/design-proposals.md)
