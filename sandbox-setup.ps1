# sandbox-setup.ps1
# eBay Sandbox APIキーを入力 → GASに自動登録 → Sandbox接続テスト
$ErrorActionPreference = "Continue"
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

function Ok($m)   { Write-Host "  [OK]  $m" -ForegroundColor Green }
function Step($m) { Write-Host ""; Write-Host "===> $m" -ForegroundColor Cyan }
function Info($m) { Write-Host "  $m" -ForegroundColor Gray }

$skelDir = "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects\ebay\gas-skeleton"
Set-Location $skelDir

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  eBay Sandbox APIキー設定 & テスト" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# ---- 1. ブラウザでDeveloper Portalを開く ----
Step "1/4  eBay Developer Portal を開きます"
Info "ブラウザで https://developer.ebay.com/my/keys が開きます"
Info "Sandbox の行にある App ID / Cert ID / Dev ID を控えてください"
Start-Process "https://developer.ebay.com/my/keys"
Write-Host ""
Read-Host "  キーを確認したら Enter を押してください"

# ---- 2. キーを入力 ----
Step "2/4  Sandboxキーを入力してください"
Write-Host ""
$appId  = Read-Host "  App ID  (例: rayozaki-xxx-SBX-xxxxxxxx)"
$certId = Read-Host "  Cert ID (例: SBX-xxxxxxxxxxxxxxxxxxxxxxxx)"
$devId  = Read-Host "  Dev ID  (例: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"

if (-not $appId -or -not $certId -or -not $devId) {
    Write-Host "  入力が空です。もう一度実行してください。" -ForegroundColor Red
    Read-Host "Enter で終了"; exit 1
}

# ---- 3. GASにpush → キー登録 ----
Step "3/4  GASにコードを送ってキーを登録"
clasp push -f
if ($LASTEXITCODE -ne 0) { Write-Host "  push失敗。clasp login を確認してください。" -ForegroundColor Red; Read-Host "Enter で終了"; exit 1 }
Ok "push 完了"

Write-Host "  APIキーをGASに登録中..." -ForegroundColor Cyan
$params = "[`"$appId`",`"$certId`",`"$devId`",`"SANDBOX`"]"
clasp run setApiKeys $params 2>&1 | Write-Host
Ok "キー登録完了"

# 設定確認
Write-Host "  設定内容を確認中..." -ForegroundColor Cyan
clasp run checkProps 2>&1 | Write-Host

# ---- 4. OAuth認可URLを生成 ----
Step "4/4  OAuth認可URL生成（ブラウザで承認してください）"
Write-Host ""
Info "次のコマンドでOAuth認可URLを生成します..."
clasp run printAuthUrl 2>&1
Write-Host ""
Write-Host "  上のURL（https://auth.sandbox.ebay.com/... で始まる）をブラウザで開いて" -ForegroundColor Yellow
Write-Host "  eBayのSandboxアカウントでログイン → 「Agree」をクリック" -ForegroundColor Yellow
Write-Host "  リダイレクト後のURL全体をコピーしてここに貼り付けてください" -ForegroundColor Yellow
Write-Host ""
$callbackUrl = Read-Host "  リダイレクトURL（https://... 全体）"

if ($callbackUrl -match "code=([^&]+)") {
    $code = $matches[1]
    Write-Host "  認可コードを取得: $($code.Substring(0, [Math]::Min(20, $code.Length)))..." -ForegroundColor Green
    Write-Host "  トークンを交換中..." -ForegroundColor Cyan
    $codeParam = "[`"$([Uri]::UnescapeDataString($code))`"]"
    clasp run exchangeCode $codeParam 2>&1 | Write-Host
    Ok "OAuth完了！リフレッシュトークンを保存しました"
} else {
    Write-Host "  URLからcodeが取得できませんでした。OAuth.gsの printAuthUrl を確認してください。" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  完了！次は clasp run pollOrders でテスト" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Enter で終了"
