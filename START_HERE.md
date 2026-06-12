# はじめに読むファイル

このフォルダには、Claude Code と Cursor × GitHub をまとめてセットアップするためのファイルが入っています。
順番に進めれば 15 ～ 30 分で「すぐ開発を始められる状態」になります。

---

## やること（3 ステップ）

### ステップ 1：setup.bat をダブルクリック

このフォルダの `setup.bat` をエクスプローラーでダブルクリックしてください。
青字のメッセージで進捗が表示され、以下が自動でインストール・設定されます。

- Git for Windows
- GitHub CLI
- Claude Code（公式ネイティブインストーラー）
- Git のユーザー名 / メール設定
- GitHub への認証（ブラウザが開きます → ログインして Authorize）
- `ebay-automation` という Private リポジトリを GitHub に作成
- 上記リポジトリを `OneDrive\ドキュメント\Claude\Projects\ebay-automation` にクローン
- CLAUDE.md テンプレートと .gitignore の補強

途中で青色や緑色のメッセージが大量に出ますが、最後に「セットアップ完了」と出れば成功です。

> **詰まったら：**
> 「SmartScreen により実行がブロックされた」と出たら、
> ダイアログの「詳細情報」→「実行」を押せば進めます。

### ステップ 2：ターミナルを開き直す

`setup.bat` を閉じたら、**新しい PowerShell を開いて**ください
（PATH を反映させるためです）。

```powershell
cd "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects\ebay-automation"
claude
```

ブラウザが開いて Claude.ai のログイン画面が出るので、`ozakiray0619@gmail.com` でログインしてください。

ターミナルに `Authenticated` と表示されたら、Claude Code の対話画面に入ります。
そこで以下を実行：

```
/init
```

プロジェクト構成を読み取り、CLAUDE.md を整えてくれます。

### ステップ 3：Cursor で同じフォルダを開く

1. Cursor を起動
2. `File` → `Open Folder`
3. `OneDrive\ドキュメント\Claude\Projects\ebay-automation` を選択

これで Cursor 側でもファイル編集 → Git コミット → GitHub にプッシュ、までボタン操作で完結します。

---

## ファイル一覧

| ファイル | 役割 |
|---|---|
| `START_HERE.md` | これ。最初に読むファイル |
| `setup.bat` | **ダブルクリックで起動するランチャ** |
| `setup.ps1` | 実体のセットアップスクリプト（PowerShell） |
| `ClaudeCode_Cursor_GitHub_セットアップガイド.docx` | 詳しい解説とトラブルシュート集（15 ページ） |

---

## うまく行かないとき

| 症状 | 対処 |
|---|---|
| `winget が見つかりません` | Microsoft Store で「アプリ インストーラー」を入れて再実行 |
| `claude コマンドが見つかりません` | PowerShell を**完全に閉じて**新しく開き直す。それでもダメなら `setup.bat` を再実行 |
| GitHub 認証に失敗 | 後で `gh auth login` を手動で実行（スクリプトは続行されます） |
| リポジトリ名が既に存在 | スクリプト内 `$RepoName` を別の名前に書き換えて再実行、または既存リポジトリを `git clone` |
| `SmartScreen でブロック` | ダイアログ左下の「詳細情報」→「実行」をクリック |

詳しい説明は `ClaudeCode_Cursor_GitHub_セットアップガイド.docx` の 8 章「トラブルシューティング」を見てください。

---

## 設定の変更

`setup.ps1` の冒頭にある以下の変数を編集すれば、リポジトリ名や格納場所を変えられます。

```powershell
$RepoName       = "ebay-automation"
$RepoVisibility = "private"        # private / public
$GitUserName    = "Rei Ozaki"
$GitUserEmail   = "ozakiray0619@gmail.com"
$ProjectRoot    = "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects"
```
