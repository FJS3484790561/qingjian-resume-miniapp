# 独立部署与联调

更新：2026-10-29。按用户新授权共用现有服务器和主域名，已启用 **https://resume.roomai.top**，独立 DNS/Nginx/证书与微信 request/downloadFile 合法域名。微信模拟器开启域名校验，真实登录、私有备份/照片与 PDF/DOCX 下载闭环通过。AI 配置及管理端后续安排，支付仍模拟。**尚未真机/用户验收或上传发布；平台保存域名不代表完成备案和上线资料。**

## 当前实际部署

- `qingyu-api.service` 已开机自启，运行账号 `qingyu`，生产模式，只监听 `127.0.0.1:8790`；开发登录关闭，AI 未配置。release `/opt/qingyu/releases/20261029-145735`，current 指向该目录。旧 release `20261029-112500` 保留；新 release 的 node_modules 复用旧 release 的同锁文件依赖目录，清理前必须解除这一依赖。
- `/etc/qingyu/api.env` 已配置本项目密钥，root:root 0600；数据库 `/var/lib/qingyu/qingyu.sqlite`，qingyu 账号私有，目录 0700、文件 0600。代码和浏览器为 root 所有，对服务账号只读；不复用其他小程序身份、数据库或凭据。
- `deploy/runtime/package.json` 和独立锁文件仅安装 102 个后端运行包。首次尝试使用根前端锁文件触发 types peer 冲突，未用 force；已分离运行依赖，并把根 types 修正为 3.4.31，通过类型检查、构建及干净安装 dry-run。
- Ubuntu 官方镜像安装 Chromium 依赖与 Noto CJK。服务器直连官方浏览器 CDN 较慢，改在本机从 Google 官方 Chrome for Testing 下载 **156.0.8078.4** 的 Linux headless ZIP，经 SSH 上传，比对 SHA256 `c3e50596aef52c58f8fda3c6b3411c33d34c88b177b3ed1c2243359fd3b8ba20`。再由 Playwright 官方安装器从临时回环缓存安装 revision 1248，FFmpeg 1013 从官方源安装。临时 8791 HTTP 进程已停止，未开放公网缓存。
- 安装脚本的长下载被中止后，已等价完成安装、只读权限和本项目服务重启。`deploy/install-release.sh` 现明确只用于首次安装；已存在 current 时拒绝执行，升级应先备份再按步骤操作，不直接重跑首次安装。
- 微信模拟器实际使用 `wx.login` → 远程 code2session → 私有备份/照片/恢复新草稿 → PDF/DOCX → 原生 downloadFile，见 `user-end-e2e-20261029.json`。PDF 中文/照片和实际排版、DOCX OOXML 已检查；原生文件查看器、Word/WPS 和真机仍待用户验收。
- 本项目服务已重启，持久数据保留。`/var/backups/qingyu/20261029-after-e2e.sqlite` 为 0600 一致性快照；恢复到独立测试文件后 integrity_check=ok、schema v4、账号/简历/照片/文件存在。未覆盖运行库，未配置自动异地备份。
- 共机 `ai-interior-api`、`roomai-payment-sandbox` 均 active、主进程未变化；`nginx -t` 成功，原有站点 HTTPS 200。仅新增 qingyu-resume 虚拟主机，未修改原站虚拟主机、其他项目数据或凭据。

## 公网域名与用户测试通道

- DNSPod 新增 A：`resume.roomai.top → 49.233.202.228`，TTL 600，原 @/www 两条记录保留；公共 DNS 已核对。
- Let's Encrypt 单独证书覆盖 `resume.roomai.top`，本轮签发到期时间 **2027-01-27 06:12:56 UTC**。ACME 复用现有生产账户，以 webroot `/var/www/qingyu-acme` 验证，没有修改主域证书。
- `/etc/nginx/sites-available/qingyu-resume` 由同名 enabled 软链加载；HTTP 保留 ACME 并 301 到 HTTPS，443 代理至回环 8790。源码模板为 `deploy/nginx-resume.roomai.top.conf`，临时首签配置为 `deploy/nginx-qingyu-acme.conf`。
- `certbot.timer` 已启用；deploy hook `/etc/letsencrypt/renewal-hooks/deploy/qingyu-reload-nginx` 先 nginx -t 再 reload。仅本证书 `certbot renew --cert-name resume.roomai.top --dry-run --run-deploy-hooks` 通过；未来实际续期仍需监控。
- 微信公众平台核对 AppID `wxdccead0ec32190d0`，管理员本人扫码后，request 与 downloadFile 均显示 `https://resume.roomai.top`；未增加不需要的 socket/uploadFile/WebView 域名。截图见 [域名配置](previews/qingyu/wechat-domains-20261029.png)。
- 生产构建默认从 `config/public-api.json` 取 HTTPS 地址，显式 VITE_API_BASE_URL 仍优先。本机忽略的 .env 已同步公开地址，服务端私有项保留。

运行 `npm run wechat:open`，重建用 `npm run wechat:rebuild`；重建后脚本关闭本项目、只清 compile 缓存再打开，避免覆盖 JS/WXML 后继续使用旧运行状态。独立 npm 命令避免本机 npm.ps1 丢失转发的 `-Build`。脚本读取实际构建 API、核对 AppID 和健康状态，HTTPS 模式开启 urlCheck，不启动 SSH。微信工具有域名缓存时，在「详情 → 项目配置」刷新域名信息并重新编译；本轮在刷新前确实被旧列表阻挡，刷新后完整闭环通过。保留 storage，不清用户草稿。

历史 SSH 回环入口仅在显式构建 `http://127.0.0.1:8787` 时使用。该模式属于本机调试、关闭本地校验；不要把它当手机地址。当前 HTTPS 测试没有 8787 监听或 SSH 隧道依赖。

公网验收报告：[TLS 与接口](previews/qingyu/public-https-20261029.json)、[微信 UI 闭环](previews/qingyu/user-end-e2e-https-20261029.json)。测试只新增已知虚构示例及其真实备份/文件，不清用户原稿、不调用 AI/支付。真机、原生文件查看器和 Word/WPS 仍待用户测试。

## 本轮升级与回滚

新 release 已部署并重启仅 qingyu-api。升级前在线一致性备份为 `/var/backups/qingyu/before-public-20261029-145735.sqlite`，私有 0600；旧 release 保留。新增 TRUST_LOCAL_PROXY=true，仅信任本机 Nginx；它覆盖 X-Forwarded-For 为真实来源，避免所有用户共用代理 IP 限流。外部伪造头与来源隔离回归通过，后端 23/23。

立即 reload 后曾短暂命中旧 worker 的原站证书；未跳过证书验证，等待新配置接管后验证 SAN、链与 TLS 1.3 正常。Nginx -t、HTTP 301、新站鉴权 401/开发身份 POST 404、原站 HTTPS 200 和三个服务 active 均通过。

需要回滚时先备份本项目数据与配置；当前同为 schema v4，可切回旧 release 后重启仅本服务。旧版不包含代理信任修正，回滚应用时应先恢复仅 ACME/404 的旧 qingyu-resume 配置并 nginx -t/reload，停止公网业务入口，再使用受控 SSH 调试。旧 Nginx 配置副本 `/var/backups/qingyu/nginx-acme-20261029.conf`。不修改原站，不能盲目降级数据库。

## 项目身份

- 简历小程序 AppID 固定 `wxdccead0ec32190d0`，微信原始账号 `gh_be04da2f9958`。本轮在公众平台“开发管理 → AppID”重新核对；不是此前登录的室内设计小程序。
- `src/manifest.json`、服务端默认值、部署环境模板一致。服务端拒绝启动于其他 AppID，避免多项目共机时串用配置。
- 用户已于 2026-10-29 提供本项目现有密钥并授权真实联调；仅配置在私有服务端文件，没有代生成、打印或提交。服务器合法域名已配置，备案及上线资料仍待完善。

## 已只读核实的服务器

腾讯云北京 `lhins-qzh75fny`，IPv4 `49.233.202.228`；Ubuntu Server 24.04 LTS，2 核/2GB/40GB/3Mbps。Node 22.23.2、npm 10.9.8、Nginx 已安装，Docker 未安装。

本次终端采样可用内存约 1237MiB、磁盘可用约 28GB，已有约 2GB swap。它是瞬时采样，不能作为并发或用户容量承诺。已有 `ai-interior-api.service`、`roomai-payment-sandbox.service`，本机端口 `8787`、`8788`；Nginx 使用 `roomai.top` / `www.roomai.top` 的 80/443。未读取这些项目的环境密钥、数据库或私有数据。

巡检截图：[服务器](previews/qingyu/server-preflight.png)、[微信 AppID](previews/qingyu/wechat-appid.png)。截图和主机信息公开提交前重新审阅；凭据永不提交。

## 独立资源约定

| 项目 | 当前值 |
| --- | --- |
| 本项目用户/服务 | `qingyu` / `qingyu-api.service` |
| 应用与切换 | `/opt/qingyu/releases/<release>`，`/opt/qingyu/current` 软链接 |
| 本机 API | `127.0.0.1:8790`，安装前再次检查端口 |
| 数据 | `/var/lib/qingyu/qingyu.sqlite`，独立 SQLite/WAL/SHM |
| 私有配置 | `/etc/qingyu/api.env`，文件权限 0600，服务读取 |
| Chromium | `/opt/qingyu/browsers`；按本项目 Playwright 版本安装 |
| 网络 | resume.roomai.top 独立 HTTPS 虚拟主机 → 回环 8790；无公网数据库端口 |

没有额外公网数据库或 API 端口，不复用现有项目的 AppSecret、模型密钥、会话、数据库或微信支付配置。现有其他项目的设置保持原样。

## 已提供的文件与本机验证

- `npm run server:build`：esbuild 0.28.2 将共享 schema/模板和服务端打包到 `dist/server/index.cjs`，Node 依赖保持 external；前端框架没有迁移。`python scripts/package-server.py` 仅白名单打包代码、独立运行锁文件与部署文件，不含密钥/数据/依赖。直接运行依赖版本与根项目一致。
- `npm run test:bundle`：从隔离临时目录启动实际产物，验证健康接口、AI 未配置和开发登录关闭；运行不需要 tsx 或前端源码。
- `deploy/qingyu-api.service`：独立低权限账号、私有目录、自动重启，MemoryHigh=650M / MemoryMax=850M / CPUQuota=100%。已在目标 Linux 的该约束下生成实际 PDF/DOCX；这不是并发容量或压力验收。
- `deploy/api.env.example`：固定 AppID、8790 端口、独立数据库、关闭开发登录，微信/AI 密钥留空。不是可直接使用的正式配置。
- `deploy/nginx-qingyu.conf.template`：仅独立域名虚拟主机；域名与证书路径为待替换占位符，不能原样加载。关闭普通请求访问日志，避免保存私有请求路径。
- `deploy/preflight.sh`：只读资源/端口/域名巡检，不打印环境、密钥或完整 Nginx 配置。
- `deploy/backup.py`：SQLite 官方备份接口生成一致性快照，包含已提交 WAL 内容；新文件 0600，不覆盖现有备份，执行完整性检查。已通过 `python deploy/test_backup.py` 的隔离 WAL/文字/BLOB 恢复及拒绝覆盖检查。备份含个人数据，异地保存与加密方案仍待上线前确定；没有配置后台自动备份任务。

## 后续升级操作参考（首轮部署及 HTTPS 已完成）

1. 再次只读巡检、确认 8790 未占用；备份本项目已有数据库和将修改的配置。保存本次及上一个 release，检查回滚程序是否支持数据库版本。不要直接 `git pull` 一个不完整的远端版本覆盖本机成果。
2. 在本机构建并测试：前后端测试/类型检查、H5/微信、server:build、test:bundle；用 package-server.py 白名单打包，将独立 runtime package/lock 与服务端包上传到新 release。依赖通过 `npm ci --omit=dev --ignore-scripts` 从官方源安装，不复制 Windows node_modules。已有安装不再执行首次安装脚本。
3. 按 Playwright 当前版本为专用目录安装 Chromium（`node node_modules/playwright/cli.js install chromium`）；系统库和 Noto CJK 中文字体通过 Ubuntu 官方软件源安装。此步骤必须在部署时实际验证；不依赖服务器上其他项目的浏览器缓存。
4. 配置独立账号/目录与 `api.env`，由用户本人提供对应 AppID 的 AppSecret。四项 AI 配置可留空以禁用；不要从其他业务复制密钥。生产模式缺微信密钥会拒绝启动，不能为绕过它启用开发登录。
5. 备份后切换 release，重启仅 qingyu-api，再在回环地址验收健康、微信会话、备份与文件，核对数据库兼容性/字体/资源，不能只切软链接就认为旧进程已更新。首次 Linux/systemd 已实测，后续升级仍要回归。
6. 用户确定备案域名、DNS 和覆盖该域名的证书后，生成独立 Nginx 配置；`nginx -t` 成功才平滑 reload。逐一回归已有站点与新 API，不重启或覆盖其他业务服务。
7. 对正确 AppID 配置 request / downloadFile 合法域名；前端 `VITE_API_BASE_URL` 设为 HTTPS 域名并重新构建。微信正式身份、手机网络/权限、文件打开和真实模型返回另行验收。
8. 上线前落实小程序名称、类目、备案、隐私和运营信息、备份恢复演练与监控；支付需正式规则/商户资料，不由示例套餐推断。

当前已有公网 HTTPS 和微信域名配置；尚无真机/上线成功结论。没有购买域名、证书或其他付费资源。AI 和管理端按用户决定稍后安排。

## 备份与恢复操作

```sh
python3 deploy/backup.py --database /var/lib/qingyu/qingyu.sqlite --output /var/backups/qingyu/before-release-YYYYMMDD.sqlite
```

恢复先停止**仅本项目**的服务，保留当前数据库和 WAL/SHM 的完整故障副本；将备份恢复到新的数据目录，核对权限、`PRAGMA integrity_check` 和 `user_version`，使用支持该版本的 release 启动验证后再切换。不要覆盖活跃数据库，不因切换软链接就假定数据库迁移可逆。当前程序版本为 v4，旧于 v4 的程序会拒绝读取新库。恢复演练需在隔离目录验证文字、照片和导出文件，不能只检查文件存在。
