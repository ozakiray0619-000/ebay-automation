# ============================================================
#  Claude Code + Cursor x GitHub  ワンクリックセットアップ
#  対象: Windows 11 / ユーザー: れい
#  使い方: 同じフォルダにある setup.bat をダブルクリック
#         （または PowerShell で  powershell -ExecutionPolicy Bypass -File .\setup.ps1）
# ============================================================

# ----- 設定（必要なら書き換えてください） -----
$RepoName       = "ebay-automation"
$RepoVisibility = "private"   # private / public
$GitUserName    = "Rei Ozaki"
$GitUserEmail   = "ozakiray0619@gmail.com"
$ProjectRoot    = "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects"

# ----- 色付きログ用ヘルパー -----
function Write-Step($msg) {
    Write-Host ""
    Write-Host "===> $msg" -ForegroundColor Cyan
}
function Write-Ok($msg)   { Write-Host "    [OK]   $msg" -ForegroundColor Green }
function Write-Skip($msg) { Write-Host "    [SKIP] $msg" -ForegroundColor Yellow }
function Write-Warn($msg) { Write-Host "    [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [ERR]  $msg" -ForegroundColor Red }

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable("Path","Machine")
    $user    = [Environment]::GetEnvironmentVariable("Path","User")
    $env:Path = "$machine;$user"
}

# ----- 開始バナー -----
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Claude Code + Cursor x GitHub  ワンクリックセットアップ" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Repo  : $RepoName ($RepoVisibility)"
Write-Host "  User  : $GitUserName <$GitUserEmail>"
Write-Host "  Root  : $ProjectRoot"
Write-Host ""

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-Warn "Administrator として実行中です。通常ユーザーでの実行が推奨ですが、このまま続行します。"
}

# ----- 1. winget の確認 -----
Write-Step "1/9  winget が使えるか確認"
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err "winget が見つかりません。Microsoft Store で『アプリ インストーラー』を入れてから再実行してください。"
    Write-Host "  https://apps.microsoft.com/detail/9NBLGGH4NNS1" -ForegroundColor Gray
    Read-Host "終了するには Enter"
    exit 1
}
Write-Ok ((winget --version) -join "")

# ----- 2. Git for Windows -----
Write-Step "2/9  Git for Windows のインストール"
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Skip ("git は既にあり: " + (git --version))
} else {
    winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
    Refresh-Path
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-Ok ("git インストール完了: " + (git --version))
    } else {
        Write-Err "git のインストール後もコマンドが見つかりません。PowerShell を一度閉じて開き直し、setup.bat を再実行してください。"
        Read-Host "終了するには Enter"
        exit 1
    }
}

# ----- 3. Git の初期設定 -----
Write-Step "3/9  Git の user.name / user.email を設定"
git config --global user.name  "$GitUserName"  | Out-Null
git config --global user.email "$GitUserEmail" | Out-Null
git config --global init.defaultBranch main    | Out-Null
git config --global core.autocrlf input        | Out-Null
Write-Ok "name=$GitUserName / email=$GitUserEmail / defaultBranch=main"

# ----- 4. GitHub CLI -----
Write-Step "4/9  GitHub CLI のインストール"
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Skip ("gh は既にあり: " + ((gh --version) | Select-Object -First 1))
} else {
    winget install --id GitHub.cli -e --source winget --accept-source-agreements --accept-package-agreements
    Refresh-Path
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        Write-Ok ("gh インストール完了: " + ((gh --version) | Select-Object -First 1))
    } else {
        Write-Err "gh が見つかりません。PowerShell を再起動して setup.bat をもう一度実行してください。"
        Read-Host "終了するには Enter"
        exit 1
    }
}

# ----- 5. GitHub 認証 -----
Write-Step "5/9  GitHub への認証 (gh auth login)"
& gh auth status *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Skip "gh は既に認証済み"
} else {
    Write-Host "    ブラウザが開きます。GitHub にログインして 'Authorize' を押してください。" -ForegroundColor Gray
    gh auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "GitHub 認証をスキップしました。後で 'gh auth login' を再実行できます。"
    } else {
        Write-Ok "GitHub 認証完了"
    }
}

# ----- 6. Claude Code -----
Write-Step "6/9  Claude Code のインストール"
if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Skip ("claude は既にあり: " + (claude --version 2>$null))
} else {
    try {
        Write-Host "    公式インストーラーを取得します ..." -ForegroundColor Gray
        Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
        Refresh-Path
        if (Get-Command claude -ErrorAction SilentlyContinue) {
            Write-Ok ("claude インストール完了: " + (claude --version 2>$null))
        } else {
            Write-Warn "claude のパスがまだ反映されていません。インストールは完了しています。"
            Write-Warn "PowerShell を一度閉じて開き直すと 'claude' コマンドが使えるようになります。"
        }
    } catch {
        Write-Err "Claude Code のインストール中にエラー: $($_.Exception.Message)"
    }
}

# ----- 7. プロジェクトフォルダ -----
Write-Step "7/9  プロジェクトフォルダの準備"
if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    New-Item -ItemType Directory -Path $ProjectRoot -Force | Out-Null
}
$repoPath = Join-Path $ProjectRoot $RepoName
Write-Ok "ルート: $ProjectRoot"

# ----- 8. GitHub リポジトリ作成 + clone -----
Write-Step "8/9  GitHub リポジトリ '$RepoName' を作成して clone"
if (Test-Path -LiteralPath $repoPath) {
    Write-Skip "$repoPath は既に存在します（リポジトリ作成 & clone はスキップ）"
} else {
    & gh auth status *> $null
    if ($LASTEXITCODE -eq 0) {
        Push-Location -LiteralPath $ProjectRoot
        try {
            $visFlag = if ($RepoVisibility -eq "public") { "--public" } else { "--private" }
            gh repo create $RepoName $visFlag `
                --description "eBay 販売自動化 (GAS + Sheets + Discord)" `
                --gitignore Node `
                --add-readme `
                --clone
            if (Test-Path -LiteralPath $repoPath) {
                Write-Ok "リポジトリ作成 & clone 完了: $repoPath"
            } else {
                Write-Warn "リポジトリは作成されたかもしれませんが、clone は失敗の可能性。GitHub 上で確認してください。"
            }
        } catch {
            Write-Err "リポジトリ作成に失敗: $($_.Exception.Message)"
        } finally {
            Pop-Location
        }
    } else {
        Write-Skip "gh 未認証のためリポジトリ作成をスキップ"
        Write-Host "    後で:  gh auth login   →   gh repo create $RepoName --private --clone" -ForegroundColor Gray
    }
}

# ----- 9. CLAUDE.md と .gitignore を整える -----
Write-Step "9/9  CLAUDE.md と .gitignore のテンプレを配置"
if (Test-Path -LiteralPath $repoPath) {
    # .gitignore 追記
    $giPath = Join-Path $repoPath ".gitignore"
    if (Test-Path -LiteralPath $giPath) {
        $current = Get-Content -LiteralPath $giPath -Raw -ErrorAction SilentlyContinue
        if ($current -notmatch "added by setup") {
            $extra = @"

# --- secrets (added by setup) ---
.env
.env.*
config.local.*
*.secret.*
credentials.json

# --- Claude Code ---
.claude/settings.local.json
.claude/cache/
"@
            Add-Content -LiteralPath $giPath -Value $extra
            Write-Ok ".gitignore に秘密情報パターンを追記"
        } else {
            Write-Skip ".gitignore は既に拡張済み"
        }
    }

    # CLAUDE.md
    $cmdPath = Join-Path $repoPath "CLAUDE.md"
    if (-not (Test-Path -LiteralPath $cmdPath)) {
        @"
# eBay 販売自動化プロジェクト

## 概要
- 目的: eBay 出品自動化、在庫管理、売上通知
- 納期: 2026年6月前半
- ステータス: Phase 0 審査中

## 技術スタック
- Google Apps Script (GAS) + clasp
- Google Sheets (在庫・売上 DB)
- Discord Webhook (通知)

## 重要ファイル
- src/main.gs : エントリーポイント
- src/ebay-api.gs : eBay API
- src/sheets.gs : Google Sheets I/O
- src/discord.gs : Discord 通知

## 秘密情報の扱い
- API キー / Webhook URL は git にコミット禁止
- 本番は GAS の PropertiesService を使用
- ローカルは .env を使い .gitignore で除外

## ビルド / デプロイ
- clasp push で GAS にアップロード
- GAS エディタの実行 or 時間トリガーで起動
"@ | Out-File -LiteralPath $cmdPath -Encoding utf8
        Write-Ok "CLAUDE.md を作成"
    } else {
        Write-Skip "CLAUDE.md は既に存在"
    }
} else {
    Write-Skip "$repoPath が無いため CLAUDE.md 配置をスキップ"
}

# ----- 完了サマリ -----
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  セットアップ完了" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$gitV    = if (Get-Command git    -ErrorAction SilentlyContinue) { git --version }                           else { "(未インストール)" }
$ghV     = if (Get-Command gh     -ErrorAction SilentlyContinue) { (gh --version | Select-Object -First 1) } else { "(未インストール)" }
$claudeV = if (Get-Command claude -ErrorAction SilentlyContinue) { claude --version 2>$null }                else { "(ターミナル再起動後に有効化)" }

Write-Host "  Git        : $gitV"     -ForegroundColor Gray
Write-Host "  GitHub CLI : $ghV"      -ForegroundColor Gray
Write-Host "  Claude Code: $claudeV"  -ForegroundColor Gray
Write-Host "  Repo       : $repoPath" -ForegroundColor Gray
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Cyan
Write-Host "  1. このウィンドウを閉じて、新しい PowerShell を起動"
Write-Host "  2. cd `"$repoPath`""
Write-Host "  3. claude       ← 初回起動でブラウザ認証 (Claude.ai)"
Write-Host "  4. /init        ← Claude の対話画面でプロジェクト自動認識"
Write-Host ""
Write-Host "Cursor で同じフォルダを開くには:" -ForegroundColor Cyan
Write-Host "  Cursor → File → Open Folder → $repoPath"
Write-Host ""

Read-Host "Enter キーで終了"
