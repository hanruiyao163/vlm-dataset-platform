$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
  throw "未找到 conda 命令，请先确认 Anaconda/Miniconda 已安装并已加入 PATH。"
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "未找到 npm 命令，请先确认 Node.js 已安装并已加入 PATH。"
}

$backendCommand = @"
Set-Location -LiteralPath '$projectRoot'
conda activate pypi
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
"@

$frontendCommand = @"
Set-Location -LiteralPath '$projectRoot\frontend'
npm run dev
"@

Start-Process pwsh -ArgumentList "-NoExit", "-Command", $backendCommand
Start-Process pwsh -ArgumentList "-NoExit", "-Command", $frontendCommand

Write-Host "前后端启动窗口已打开。"
Write-Host "前端: http://127.0.0.1:5173"
Write-Host "后端: http://127.0.0.1:8000"
