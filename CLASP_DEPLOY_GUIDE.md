# clasp & GAS デプロイ手順書（Windows 11 / PowerShell）

> **対象**: `gas-skeleton/` を Google Apps Script へ初回デプロイし、Phase 1 モック動作確認まで通す
> **所要**: 約20〜30分（途中で Google 認証が入る）

---

## 前提環境

| 必要 | バージョン | インストール確認コマンド |
|---|---|---|
| Node.js | 18 以上 | `node -v` |
| npm | 9 以上 | `npm -v` |
| Google アカウント | — | （ozakiray0619@gmail.com で OK） |

Node 未インストールの場合: <https://nodejs.org/ja/download> から LTS 版を入れる。

---

## Step 1: clasp インストール（1分）

PowerShell を**通常権限で**開いて実行:

```powershell
npm install -g @google/clasp
clasp --version
```

`2.x.x` 等のバージョン番号が出れば OK。

> ⚠️ もし `clasp: 用語 ... 認識されない` と出る場合は新しい PowerShell を開き直し（PATH 反映）。

---

## Step 2: clasp ログイン（2分）

```powershell
clasp login
```

ブラウザが開いて Google 認証画面が出る → ozakiray0619@gmail.com でログイン → 「許可」をクリック。
ターミナルに `Authorization successful.` が出れば OK。

---

## Step 3: 受け入れ先スプレッドシート作成（2分）

1. <https://drive.google.com/> でログイン
2. 「新規」→「Google スプレッドシート」→ 空のスプレッドシート作成
3. 名前を `eBay自動化_受入シート` 等に変更
4. URL の `/d/` と `/edit` の間にある **スプレッドシートID** をコピー
   - 例: `https://docs.google.com/spreadsheets/d/`**`1AbCdEfGhIjKlMnO123`**`/edit`
5. スプレッドシート上で「拡張機能」→「Apps Script」を開く
6. 開いた GAS プロジェクトの URL に `script.google.com/.../d/` の間に **スクリプトID** が含まれる
   - 例: `https://script.google.com/macros/d/`**`1xYzZyWwVvUu456`**`/edit`

---

## Step 4: ローカルプロジェクトを GAS と紐付け（1分）

PowerShell で `gas-skeleton/` に移動:

```powershell
cd "$env:USERPROFILE\OneDrive\ドキュメント\Claude\Projects\ebay\gas-skeleton"
```

`.clasp.json` を作成（または編集）:

```powershell
@"
{
  "scriptId": "1xYzZyWwVvUu456",
  "rootDir": "."
}
"@ | Set-Content -Path ".clasp.json" -Encoding utf8
```

> `1xYzZyWwVvUu456` を Step 3-6 でメモした実際のスクリプトIDに置き換え。

---

## Step 5: コードを GAS へ push（1分）

```powershell
clasp push
```

`Pushed 11 files.` のような表示が出れば成功。
ブラウザで GAS エディタを再読込すると、`Config.gs` / `OAuth.gs` 等が左サイドバーに並ぶ。

> ⚠️ `Push failed. Errors:` が出たら `clasp push -f` で強制 push 可能（既存ファイルを上書き）。

---

## Step 6: スクリプトプロパティ設定（5分）

GAS エディタ画面で:

1. 左サイドバー下部の **歯車アイコン（プロジェクトの設定）** をクリック
2. 「スクリプト プロパティ」セクションの「スクリプト プロパティを追加」
3. 以下を **Phase 1 用** として最低限設定:

| プロパティ | 値 |
|---|---|
| `EBAY_ENV` | `SANDBOX` |
| `SPREADSHEET_ID` | Step 3-4 でメモしたスプレッドシートID |
| `DISCORD_WEBHOOK_URL` | テスト用 Webhook URL（未設定でも動く、その場合 logs シートにスキップ記録） |

Phase 2 で追加するもの（Sandbox keyset取得後）:

| プロパティ | 値 |
|---|---|
| `EBAY_APP_ID` | Sandbox App ID |
| `EBAY_CERT_ID` | Sandbox Cert ID |
| `EBAY_DEV_ID` | Sandbox Dev ID |
| `EBAY_RU_NAME` | RuName 文字列 |
| `EBAY_AUTH_TOKEN` | Trading API Auth'n'Auth Token（F-03用） |
| `EBAY_REFRESH_TOKEN` | OAuth認可完了後に自動セット（手動入力不要） |

---

## Step 7: シート初期化（1分）

GAS エディタの上部関数選択ドロップダウンで `setupSheets` を選ぶ → 「実行」ボタン
- 初回は権限承認ダイアログ → 「権限を確認」→ アカウント選択 → 「詳細」→「（安全でないページ）に移動」→「許可」
  - 自分のスクリプトなので安全。Google の警告は未確認スクリプト全般に出る
- 成功すると `orders` `offers` `logs` の3シートがスプレッドシートに追加される

---

## Step 8: モック実行（1分）

GAS エディタで関数選択 → `mockPollOrders` → 「実行」
- `orders` シートに2行追加されることをスプレッドシート側で確認
- `商品名(日本語)` 列が翻訳結果になっていることを確認

続けて `mockPollOffers` → 「実行」
- `offers` シートに1行追加
- `通知済` 列が TRUE
- Discord 未設定なら `logs` シートに `Discord webhook not configured ...` 記録

ここまで動けば **Phase 1 完了**。

---

## Step 9: メニュー有効化のためスプレッドシート再読込（30秒）

スプレッドシートのタブをブラウザで再読込（F5）すると、上部メニューに **🤖 eBay自動化** が出現。
以降は GAS エディタを開かなくても、スプレッドシートのメニューから各処理を実行できる。

---

## Step 10: Web App デプロイ（Phase 2 で実施 / 今は不要）

eBay OAuth コールバック先 URL を確定するため、Production Keyset 取得前後で実施:

1. GAS エディタ右上「デプロイ」→「新しいデプロイ」
2. 種類: 歯車 →「ウェブアプリ」
3. 設定:
   - 説明: `eBay OAuth Callback v1`
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
4. 「デプロイ」→ 発行された **ウェブアプリ URL** をコピー
5. eBay Developer Console の RuName 設定で、Redirect URL をこの URL に更新

> ⚠️ コード修正のたびに「**新しいデプロイ**」ではなく「**デプロイを管理**」→「**バージョン**」を更新する。
> 新規デプロイすると URL が変わる → eBay 側の RuName 設定も再更新が必要になる。

---

## トラブルシュート

| 症状 | 対処 |
|---|---|
| `clasp` not found | PowerShell を閉じて開き直す。それでもダメなら `npm root -g` のパスを PATH に追加 |
| `User has not enabled the Apps Script API` | <https://script.google.com/home/usersettings> で「Google Apps Script API」をオン |
| `Push failed: ScriptId not found` | `.clasp.json` のスクリプトIDが間違い、または別アカウントのスクリプト |
| `LanguageApp.translate is not a function` | `appsscript.json` の `runtimeVersion` が `V8` か確認 |
| シートが見つからない | `setupSheets` を実行していない or `SPREADSHEET_ID` が違うシートを指している |
| Discord webhook 401/404 | URL の打ち間違い。Webhook を再発行して上書き |

---

## 開発フロー（以降）

ローカル `gas-skeleton/` で編集 → `clasp push` → GAS エディタで動作確認、を繰り返す。
バージョン管理は Git で `gas-skeleton/` ごと管理。`.clasp.json` は `.gitignore` 済みで秘密保持OK。

```powershell
# 編集後
clasp push

# 強制push（リネーム等で衝突したとき）
clasp push -f

# GAS エディタを開く
clasp open
```
