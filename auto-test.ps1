# auto-test.ps1 — clasp push → deploy → run まで全自動
$ErrorActionPreference = "Continue"
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

function Ok($m)   { Write-Host "  [OK]  $m" -ForegroundColor Green }
function Err($m)  { Write-Host "  [ERR] $m" -ForegroundColor Red }
function Step($m) { Write-Host ""; Write-Host "===> $m" -ForegroundColor Cyan }

$skelDir = "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects\ebay\gas-skeleton"
Set-Location $skelDir

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  eBay自動化 — 全自動テスト実行" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# ---- 1. clasp push ----
Step "1/4  最新コードを GAS に送信"
clasp push -f
if ($LASTEXITCODE -ne 0) { Err "push 失敗。clasp login を再実行してください。"; Read-Host "Enter で終了"; exit 1 }
Ok "push 完了"

# ---- 2. API実行可能としてデプロイ ----
Step "2/4  API実行可能としてデプロイ"
$deployOut = clasp deploy --description "auto-exec" 2>&1
Write-Host $deployOut
Ok "deploy 完了"

# ---- 3. bootstrap（スプレッドシート自動生成） ----
Step "3/4  スプレッドシートを自動生成 (bootstrap)"
$result = clasp run bootstrap 2>&1
Write-Host $result

if ($result -match "error|Error|失敗|UNAUTHENTICATED|not been enabled") {
    Write-Host ""
    Write-Host "  clasp run が有効化されていません。" -ForegroundColor Yellow
    Write-Host "  ブラウザで以下を開いて Apps Script API を ON にしてください：" -ForegroundColor Yellow
    Write-Host "  https://script.google.com/home/usersettings" -ForegroundColor Cyan
    Write-Host ""
    Start-Process "https://script.google.com/home/usersettings"
    Read-Host "  ON にしたら Enter を押してください"

    Write-Host ""
    Write-Host "  再度 bootstrap を実行します..." -ForegroundColor Cyan
    $result = clasp run bootstrap 2>&1
    Write-Host $result
}

# URL を抽出して表示
$url = ($result | Select-String "https://docs.google.com/spreadsheets/d/[^\s""']+").Matches.Value
if ($url) {
    Ok "スプレッドシート生成完了！"
    Write-Host "  URL: $url" -ForegroundColor Green
    Start-Process $url
} else {
    Write-Host "  スプレッドシートURL取得済み（ログを確認）" -ForegroundColor Yellow
}

# ---- 4. モックテスト実行 ----
Step "4/4  モックテスト実行"

Write-Host "  mockPollOrders を実行中..." -ForegroundColor Cyan
clasp run mockPollOrders 2>&1 | Write-Host
Ok "注文モックデータ → orders シートに書き込み完了"

Write-Host ""
Write-Host "  mockPollOffers を実行中..." -ForegroundColor Cyan
clasp run mockPollOffers 2>&1 | Write-Host
Ok "オファーモックデータ → offers シートに書き込み完了"

# ---- 完了 ----
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  テスト完了！スプレッドシートを確認してください" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
if ($url) { Write-Host "  $url" -ForegroundColor Green }
Write-Host ""
Read-Host "Enter で終了"
