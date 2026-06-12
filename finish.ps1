# ============================================================
#  finish.ps1  (ASCII-only, encoding-safe)
#  Run AFTER `gh auth login` has finished.
# ============================================================

$ErrorActionPreference = "Continue"

$RepoName    = "ebay-automation"
$ProjectRoot = "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects"
$SrcFolder   = "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects\ebay"
$RepoPath    = Join-Path $ProjectRoot $RepoName

function Ok($m)   { Write-Host "    [OK]   $m" -ForegroundColor Green }
function Skip($m) { Write-Host "    [SKIP] $m" -ForegroundColor Yellow }
function Warn($m) { Write-Host "    [WARN] $m" -ForegroundColor Yellow }
function Err($m)  { Write-Host "    [ERR]  $m" -ForegroundColor Red }
function Step($m) { Write-Host ""; Write-Host "===> $m" -ForegroundColor Cyan }

# Refresh PATH so freshly installed tools are visible
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  ebay-automation finish script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ---- 1. check gh / git ----
Step "1/5  check gh and git"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Err "gh is not on PATH. Open an admin PowerShell and run: winget install --id GitHub.cli"
    Read-Host "Press Enter to exit"
    exit 1
}
Ok ("gh " + ((gh --version | Select-Object -First 1)))

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Warn "git not found, installing..."
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Err "git install failed. Open a fresh admin PowerShell and retry."
    Read-Host "Press Enter to exit"
    exit 1
}
Ok (git --version)

# Make sure git has user identity
$cfgName  = (git config --global user.name)  2>$null
$cfgEmail = (git config --global user.email) 2>$null
if (-not $cfgName)  { git config --global user.name  "Rei Ozaki"          | Out-Null }
if (-not $cfgEmail) { git config --global user.email "ozakiray0619@gmail.com" | Out-Null }
git config --global init.defaultBranch main | Out-Null

# ---- 2. gh auth status (auto-login if missing) ----
Step "2/5  gh auth status"

# Silent check: capture stderr to avoid NativeCommandError noise
$null = (& gh auth status 2>&1)
$authed = ($LASTEXITCODE -eq 0)

if (-not $authed) {
    Warn "gh is not authenticated yet. Launching browser login in THIS window..."
    Write-Host ""
    Write-Host "  >>> An 8-character code will appear (e.g. ABCD-1234)." -ForegroundColor Yellow
    Write-Host "  >>> Select it with the mouse, right-click to copy." -ForegroundColor Yellow
    Write-Host "  >>> Press Enter to open the browser." -ForegroundColor Yellow
    Write-Host "  >>> Paste the code, click Continue, then Authorize." -ForegroundColor Yellow
    Write-Host "  >>> Return here -- the script continues automatically." -ForegroundColor Yellow
    Write-Host ""

    & gh auth login --hostname github.com --git-protocol https --web
    $loginExit = $LASTEXITCODE

    # Re-check auth regardless of reported exit code
    $null = (& gh auth status 2>&1)
    $authed = ($LASTEXITCODE -eq 0)

    if (-not $authed) {
        Err "gh auth login did not complete (exit=$loginExit)."
        Err "Open the browser tab once more and finish clicking 'Authorize github' (green button)."
        Err "Then re-run finish.bat."
        Read-Host "Press Enter to exit"
        exit 1
    }
}
Ok "gh authenticated"

# ---- 3. create + clone repo ----
Step "3/5  create GitHub repo and clone"
if (Test-Path -LiteralPath $RepoPath) {
    Skip "$RepoPath already exists (skipping create/clone)"
} else {
    if (-not (Test-Path -LiteralPath $ProjectRoot)) {
        New-Item -ItemType Directory -Path $ProjectRoot -Force | Out-Null
    }
    Push-Location -LiteralPath $ProjectRoot
    try {
        gh repo create $RepoName --private `
            --description "eBay sales automation (GAS + Sheets + Discord)" `
            --gitignore Node `
            --add-readme `
            --clone
        if (Test-Path -LiteralPath $RepoPath) {
            Ok "created and cloned: $RepoPath"
        } else {
            Err "repo created but clone failed. Try: gh repo clone $RepoName"
            Read-Host "Press Enter to exit"
            exit 1
        }
    } finally {
        Pop-Location
    }
}

# ---- 4. copy current ebay folder content into the new repo ----
Step "4/5  copy current ebay folder into new repo"
$excludes = @(
    "setup.bat", "setup.ps1", "finish.bat", "finish.ps1",
    ".finish.ps1.tmp",
    "START_HERE.md",
    ".git", ".github"
)
$copied = 0
Get-ChildItem -LiteralPath $SrcFolder -Force | ForEach-Object {
    if ($excludes -contains $_.Name) { return }
    $dst = Join-Path $RepoPath $_.Name
    if ($_.PSIsContainer) {
        Copy-Item -LiteralPath $_.FullName -Destination $dst -Recurse -Force
    } else {
        Copy-Item -LiteralPath $_.FullName -Destination $dst -Force
    }
    $copied++
}
Ok "$copied items copied"

# ---- 5. commit and push ----
Step "5/5  commit and push"
Push-Location -LiteralPath $RepoPath
try {
    git add .
    $status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($status)) {
        Skip "nothing to commit"
    } else {
        git commit -m "chore: bootstrap project from local ebay folder (Phase 0)"
        git push
        Ok "pushed to GitHub"
    }
} finally {
    Pop-Location
}

# ---- summary + open browser ----
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  DONE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$ghUser = (gh api user --jq .login 2>$null)
if ($ghUser) {
    $repoUrl = "https://github.com/$ghUser/$RepoName"
    Write-Host "  GitHub : $repoUrl" -ForegroundColor Gray
    Start-Process $repoUrl
}
Write-Host "  Local  : $RepoPath" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. open a NEW PowerShell"
Write-Host "  2. cd `"$RepoPath`""
Write-Host "  3. claude"
Write-Host "  4. /init"
Write-Host ""

Read-Host "Press Enter to exit"
