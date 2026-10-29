param(
    [switch]$Build,
    [string]$CliPath = 'D:\微信web开发者工具\cli.bat'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'dist/build/mp-weixin'
$sshTarget = 'ubuntu@49.233.202.228'
$forward = '127.0.0.1:8787:127.0.0.1:8790'
$createdTunnel = $null
Push-Location $root
try {
    if ($Build) {
        & npm run build:mp-weixin
        if ($LASTEXITCODE -ne 0) { throw '微信构建未通过，请先修复构建。' }
    }
    if (!(Test-Path -LiteralPath $CliPath)) { throw '未找到开发者工具，请通过 -CliPath 指定已安装的 cli.bat。' }
    $config = Get-Content -Raw -Encoding UTF8 (Join-Path $project 'project.config.json') | ConvertFrom-Json
    if ($config.appid -ne 'wxdccead0ec32190d0') { throw 'AppID 不匹配，已停止打开。' }
    $backend = Get-Content -Raw -Encoding UTF8 (Join-Path $project 'features/resume/backend.js')
    $addresses = @([regex]::Matches($backend, 'https?://(?:127\.0\.0\.1|localhost|resume\.roomai\.top)(?::\d+)?') | ForEach-Object { $_.Value } | Select-Object -Unique)
    if ($addresses.Count -ne 1) { throw '不能从构建包确定唯一的本项目 API 地址，请重新构建。' }
    $apiUrl = $addresses[0]
    if ($apiUrl -notin @('https://resume.roomai.top','http://127.0.0.1:8787')) { throw '构建包使用了未约定的 API 地址。' }
    $usingTunnel = $apiUrl -eq 'http://127.0.0.1:8787'
    if ($usingTunnel) {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort 8787 -ErrorAction SilentlyContinue)
    if ($listeners.Count) {
        foreach ($listener in $listeners) {
            $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
            if ($process.Name -ne 'ssh.exe' -or !$process.CommandLine.Contains($forward) -or !$process.CommandLine.Contains($sshTarget)) {
                throw '本机 8787 已被其他进程占用。已保留原进程，请先确认端口安排。'
            }
        }
    } else {
        New-Item -ItemType Directory -Force (Join-Path $root 'server/data') | Out-Null
        $ssh = (Get-Command ssh.exe).Source
        $createdTunnel = Start-Process -FilePath $ssh -ArgumentList @('-N','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','-L',$forward,$sshTarget) -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $root 'server/data/wechat-tunnel.log')
        Write-Host '已启动本项目回环 SSH 通道，正在核对远程服务。'
    }
    }
    $ready = $false
    for ($attempt = 0; $attempt -lt 12; $attempt++) {
        try {
            $health = Invoke-RestMethod ($apiUrl + '/health') -TimeoutSec 10
            if ($health.service -eq 'qingyu-api' -and $health.wechatLogin -and !$health.developmentLogin) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (!$ready) { throw '简历服务未就绪，请检查构建地址、HTTPS/DNS 或本机 SSH 通道。不会切换为模拟身份。' }
    $privatePath = Join-Path $project 'project.private.config.json'
    $private = if (Test-Path -LiteralPath $privatePath) { Get-Content -Raw -Encoding UTF8 $privatePath | ConvertFrom-Json } else { [pscustomobject]@{} }
    if (!$private.PSObject.Properties['setting']) { $private | Add-Member -NotePropertyName setting -NotePropertyValue ([pscustomobject]@{}) }
    $private.setting | Add-Member -NotePropertyName urlCheck -NotePropertyValue (!$usingTunnel) -Force
    [System.IO.File]::WriteAllText($privatePath, ($private | ConvertTo-Json -Depth 30), [System.Text.UTF8Encoding]::new($false))
    if ($Build) {
        # Replacing generated JS/WXML in an open IDE can leave a stale runtime.
        # Restart this project and clear compile only; keep drafts/files/login.
        & $CliPath close --project $project
        if ($LASTEXITCODE -ne 0) { throw '构建已完成，但项目关闭失败；请关闭本项目后重试。' }
        & $CliPath cache --clean compile --project $project
        if ($LASTEXITCODE -ne 0) { throw '编译缓存刷新失败，已停止打开；本机数据保留。' }
    }
    & $CliPath open --project $project
    if ($LASTEXITCODE -ne 0) { throw '开发者工具打开失败，请查看 CLI 输出；远程服务保留。' }
    Write-Host ('微信开发者工具已打开，实际构建 API：' + $apiUrl)
    if ($usingTunnel) { Write-Host '当前为本机 SSH 回环联调，仅用于开发者工具。' }
    else { Write-Host '当前直接连接 HTTPS，已开启合法域名校验；不依赖本机 SSH 隧道。' }
} catch {
    if ($createdTunnel -and !$createdTunnel.HasExited) { Stop-Process -Id $createdTunnel.Id }
    throw
} finally { Pop-Location }
