$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path


$backendCommand = @"
Set-Location -LiteralPath '$projectRoot'
uv run python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
"@

$frontendCommand = @"
Set-Location -LiteralPath '$projectRoot\frontend'
npm run dev
"@

Start-Process pwsh -ArgumentList "-NoExit", "-Command", $backendCommand
Start-Process pwsh -ArgumentList "-NoExit", "-Command", $frontendCommand

Write-Host "前后端启动窗口已打开。"
Write-Host "前端: http://localhost:5173"
Write-Host "后端: http://localhost:8000"
