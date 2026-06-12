# test-and-push.ps1
# 今日の進捗をGASに反映してGitHubにpushする

$ErrorActionPreference = "Continue"
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

function Ok($m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Step($m) { Write-Host ""; Write-Host "===> $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  eBay自動化 — テスト準備 & GitHub push" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$root = "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects\ebay"

# ---- 1. gas-skeleton を clasp push ----
Step "1/3  gas-skeleton を GAS に反映"
$skelDir = "$root\gas-skeleton"
if (Test-Path "$skelDir\.clasp.json") {
    Push-Location $skelDir
    clasp push -f
    if ($LASTEXITCODE -eq 0) { Ok "gas-skeleton push 完了" }
    else { Warn "gas-skeleton push でエラーが出ました（上のメッセージを確認）" }
    Pop-Location
} else {
    Warn "gas-skeleton\.clasp.json が見つかりません。スキップします"
}

# ---- 2. gas-reply を clasp push ----
Step "2/3  gas-reply を GAS に反映"
$replyDir = "$root\gas-reply"
if (Test-Path "$replyDir\.clasp.json") {
    Push-Location $replyDir
    clasp push -f
    if ($LASTEXITCODE -eq 0) { Ok "gas-reply push 完了" }
    else { Warn "gas-reply push でエラーが出ました（上のメッセージを確認）" }
    Pop-Location
} else {
    Warn "gas-reply\.clasp.json が見つかりません。スキップします"
}

# ---- 3. GitHub に今日の進捗をpush ----
Step "3/3  GitHub に今日の進捗を push"

# GitHubリポジトリの場所を探す
$repoCandidates = @(
    "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects\ebay-automation",
    "$root"
)
$repoPath = $null
foreach ($c in $repoCandidates) {
    if (Test-Path "$c\.git") { $repoPath = $c; break }
}

if (-not $repoPath) {
    Warn "gitリポジトリが見つかりませんでした。"
    Write-Host "  以下のフォルダのどれかに .git フォルダがあるか確認してください：" -ForegroundColor Yellow
    $repoCandidates | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
} else {
    Push-Location $repoPath
    git add .
    $status = (git status --porcelain)
    if ([string]::IsNullOrWhiteSpace($status)) {
        Warn "コミットする変更がありません（既にpush済み）"
    } else {
        $date = (Get-Date -Format "yyyy-MM-dd")
        git commit -m "feat: Phase 1 モックテスト確認 ($date) — gas-skeleton/gas-reply 全ファイル"
        git push
        if ($LASTEXITCODE -eq 0) { Ok "GitHub push 完了！" }
        else { Warn "push失敗。gh auth login が必要かもしれません" }
    }

    # GitHub URL を表示
    $remote = (git remote get-url origin 2>$null)
    if ($remote) {
        $url = $remote -replace "\.git$", ""
        Write-Host ""
        Write-Host "  GitHubで見る : $url" -ForegroundColor Green
        Start-Process $url
    }
    Pop-Location
}

# ---- 完了メッセージ ----
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  GAS push 完了！次はGASエディタでテスト" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ブラウザで GAS エディタを開いて以下を実行：" -ForegroundColor White
Write-Host "    1. setupSheets()      → シート作成（初回のみ）" -ForegroundColor Gray
Write-Host "    2. mockPollOrders()   → 注文2件を orders シートに書き込み" -ForegroundColor Gray
Write-Host "    3. mockPollOffers()   → オファー1件を offers シートに書き込み + Discord通知" -ForegroundColor Gray
Write-Host ""
Write-Host "  GAS エディタを開くには：" -ForegroundColor White
Write-Host "    cd gas-skeleton" -ForegroundColor Gray
Write-Host "    clasp open" -ForegroundColor Gray
Write-Host ""
Read-Host "Enter で終了"
