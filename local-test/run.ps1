# run.ps1 — 偽eBayサーバーを起動してポーラーを実行する(ワンコマンド)
#
#   .\run.ps1            # 1回だけ通知テスト
#   .\run.ps1 -Loop 30   # 30秒ごとに繰り返し(Ctrl+Cで停止)
#   .\run.ps1 -Reset     # 重複防止の履歴(.state.json)を消してから実行
#
# Discord本送信したい場合は config.json に Webhook URL を入れる(無ければドライラン)。

param(
  [int]$Loop = 0,
  [switch]$Reset
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# Node があるか確認
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js が見つかりません。https://nodejs.org からインストールしてください。"
  exit 1
}

if ($Reset -and (Test-Path "$here\.state.json")) {
  Remove-Item "$here\.state.json"
  Write-Host "履歴(.state.json)をリセットしました" -ForegroundColor Yellow
}

# 偽eBayサーバーをバックグラウンド起動
Write-Host "偽eBayサーバーを起動中..." -ForegroundColor Cyan
$server = Start-Process node -ArgumentList "mock-ebay-server.js" -PassThru -NoNewWindow
Start-Sleep -Seconds 1

try {
  $pollerArgs = @("poller.js")
  if ($Loop -gt 0) { $pollerArgs += @("--loop", "$Loop") }
  node @pollerArgs
}
finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
    Write-Host "偽eBayサーバーを停止しました" -ForegroundColor Cyan
  }
}
