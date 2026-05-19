#
# setup.ps1 - eBay自動化システム セットアップヘルパー
#

$ErrorActionPreference = 'Stop'

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " eBay自動化システム セットアップ" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$skeletonDir = "C:\Users\ozaki\OneDrive\ドキュメント\Claude\Projects\ebay\gas-skeleton"
Set-Location $skeletonDir
Write-Host "[1/3] 作業ディレクトリ: $skeletonDir" -ForegroundColor Green

if (-not (Test-Path ".clasp.json")) {
    Write-Host "[ERROR] .clasp.json が見つかりません。" -ForegroundColor Red
    exit 1
}
Write-Host "[2/3] .clasp.json 確認 OK" -ForegroundColor Green

Write-Host "[3/4] clasp push -f を実行..." -ForegroundColor Green
clasp push -f

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] clasp push に失敗しました。clasp login が済んでいるか確認してください。" -ForegroundColor Red
    exit 1
}

# 4. スプレッドシートを自動で開く
Write-Host "[4/4] スプレッドシートをブラウザで開く..." -ForegroundColor Green
$urlFile = ".spreadsheet-url"
if (-not (Test-Path $urlFile)) {
    Write-Host ""
    Write-Host "[初回設定] スプレッドシートのURLを教えてください。" -ForegroundColor Yellow
    Write-Host "（次回以降はこの入力は不要です）" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "確認方法: ブラウザのスプレッドシートのタブを開く -> アドレスバーのURLを全部コピー" -ForegroundColor DarkGray
    Write-Host "例: https://docs.google.com/spreadsheets/d/1AbC.../edit" -ForegroundColor DarkGray
    Write-Host ""
    $spreadsheetUrl = Read-Host "スプレッドシートURLを貼り付けて Enter"
    if ([string]::IsNullOrWhiteSpace($spreadsheetUrl)) {
        Write-Host "[WARN] URLが空のため、自動オープンをスキップしました。" -ForegroundColor Yellow
    } else {
        Set-Content -Path $urlFile -Value $spreadsheetUrl.Trim() -Encoding UTF8
        Start-Process $spreadsheetUrl.Trim()
        Write-Host "URLを保存しました: $urlFile" -ForegroundColor Green
    }
} else {
    $spreadsheetUrl = (Get-Content $urlFile -Raw).Trim()
    Start-Process $spreadsheetUrl
    Write-Host "ブラウザでスプレッドシートを開きました。" -ForegroundColor Green
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " 完了" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "ブラウザで自動的にスプレッドシートが開きます。" -ForegroundColor Yellow
Write-Host "下部タブに orders / offers / logs の3シートが追加されていれば成功です。" -ForegroundColor White
Write-Host ""
Write-Host "もし権限承認のポップアップが出たら 許可 をクリックしてください。" -ForegroundColor DarkGray
Write-Host ""