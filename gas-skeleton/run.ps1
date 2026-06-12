# run.ps1 — PowerShell から GAS を「送って・動かす」ワンショットスクリプト
#
# 使い方（gas-skeleton フォルダ内で実行）:
#   .\run.ps1            … コードをpush して bootstrap() を実行（スプレッドシート自動生成＋3シート作成）
#   .\run.ps1 mockPollOrders   … 任意の関数名を渡すとその関数を実行
#   .\run.ps1 -NoPush bootstrap … push を省略して実行だけ
#
# 前提: 一度だけ SETUP_CLASP_RUN.md の手順で clasp run を有効化しておくこと。

param(
    [string]$Function = "bootstrap",
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

# このスクリプトのある場所をカレントにする（どこから呼んでもOK）
Set-Location -Path $PSScriptRoot

# clasp があるか確認
if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
    Write-Host "clasp が見つかりません。先に 'npm install -g @google/clasp' を実行してください。" -ForegroundColor Red
    exit 1
}

if (-not $NoPush) {
    Write-Host "==> clasp push（コードを Apps Script へ送信）" -ForegroundColor Cyan
    clasp push -f
}

Write-Host "==> clasp run $Function（関数を実行）" -ForegroundColor Cyan
clasp run $Function

Write-Host "完了。スプレッドシートのURLは上の実行結果（戻り値）に表示されます。" -ForegroundColor Green
