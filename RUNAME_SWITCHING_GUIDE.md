# RuName / OAuth Redirect URI 切替手順書

> **背景**: Sandbox は仮 URL でOKだが、Production では正しい GAS Web App URL を RuName として登録する必要がある。
> このドキュメントは、Phase 2（Sandbox連携）と Phase 3（Production移行）それぞれでの RuName 設定を時系列で示す。

---

## 用語整理

| 用語 | 意味 |
|---|---|
| **Redirect URI** | OAuth 認可後にコードを受け取るURL（GAS Web App の `/exec` URL） |
| **RuName** | eBay が払い出す Redirect URI の別名文字列（`Your_Name-XXXX-XXXX-XXXX` 形式） |
| **API 呼び出し時** | `RuName` を使う（生 URL ではない） |

⚠️ コードで `redirect_uri` パラメータに渡すのは **RuName** であって URL そのものではない。`EBAY_RU_NAME` スクリプトプロパティにも RuName を入れる。

---

## Phase 2: Sandbox 段階の RuName 設定

### Step 1: GAS Web App をデプロイして URL を確定

`CLASP_DEPLOY_GUIDE.md` Step 10 の手順で Web App デプロイ。
発行された URL（`https://script.google.com/macros/s/AKfycb.../exec`）をコピー。

### Step 2: eBay Developer Console で Sandbox 用 RuName 登録

1. <https://developer.ebay.com/my/keys> にアクセス
2. **Sandbox** 列の「User Tokens」リンク
3. 「Get a Token from eBay via Your Application」セクション
4. 「Add eBay Redirect URL」ボタン
5. フォーム入力:
   - **Display Title**: `eBay Automation - Sandbox`
   - **Privacy Policy URL**: 仮で `https://example.com/privacy` でも通る（Sandbox）
   - **Auth Accepted URL**: Step 1 で取得した Web App URL
   - **Auth Declined URL**: 同上（同じURLで可）
6. 「Save」→ 払い出された **RuName 文字列**をコピー
   - 形式例: `Rei_Ozaki-ReiOzak-MyApp-azbycxd`

### Step 3: GAS スクリプトプロパティに反映

GAS エディタ → 歯車 → スクリプトプロパティ:
- `EBAY_RU_NAME` = Step 2-6 でコピーした RuName

### Step 4: 認可フロー動作確認

1. ブラウザで Web App URL（`/exec`）を開く
2. 「eBay でログインして認可する」ボタンクリック
3. Sandbox の eBay ログイン画面で Sandbox テストアカウントでログイン
   - Sandbox テストアカウントは Developer Console → Sandbox Test Users で作成可能
4. 「許可する」をクリック
5. 元の Web App 画面に戻り「認可が完了しました ✓」表示
6. GAS スクリプトプロパティに `EBAY_REFRESH_TOKEN` が自動セットされていることを確認

### Step 5: pollOrders() 実機テスト

GAS エディタで `pollOrders` 実行
- Sandbox テストアカウントの注文が `orders` シートに入れば OK
- エラー時は `logs` シートを確認

---

## Phase 3: Production 移行時の RuName 切替

### 注意: Production の RuName は新規作成（Sandbox のものは流用不可）

eBay は Sandbox と Production で完全に別キーセット・別 RuName。
**同じ Web App URL を Production 用にも別途登録する。**

### Step 1: Production Keyset 取得確認

<https://developer.ebay.com/my/keys> の **Production** 列に keyset が表示されていること（`Approved`）。

### Step 2: Production 用 RuName 登録

1. Developer Console **Production** 列の「User Tokens」リンク
2. 「Add eBay Redirect URL」ボタン
3. フォーム入力:
   - **Display Title**: `eBay Automation - Production`
   - **Privacy Policy URL**: **本番URL必須**（クライアントの会社サイトのプライバシーポリシー or 自分で簡易ページ作成）
   - **Auth Accepted URL**: Phase 2 と同じ Web App URL（`/exec`）
   - **Auth Declined URL**: 同上
4. 「Save」→ Production 用 RuName 文字列をコピー
   - 形式例: `Rei_Ozaki-ReiOzak-MyApp-PRDxyz123`

### Step 3: スクリプトプロパティを Production 用に切替

GAS エディタ → スクリプトプロパティ で以下を更新:

| プロパティ | Sandbox → Production の値 |
|---|---|
| `EBAY_ENV` | `SANDBOX` → `PRODUCTION` |
| `EBAY_APP_ID` | Production の App ID |
| `EBAY_CERT_ID` | Production の Cert ID |
| `EBAY_DEV_ID` | Production の Dev ID |
| `EBAY_RU_NAME` | Production の RuName |
| `EBAY_AUTH_TOKEN` | Production の Trading API Auth'n'Auth Token |
| `EBAY_REFRESH_TOKEN` | **空欄に戻す**（Step 4 で再認可後に自動セット） |

### Step 4: クライアントへ本番認可URLを送付

Web App URL をクライアントに送付:

```
〇〇 様
お疲れ様です。
下記URLにアクセスし、「eBay でログインして認可する」をクリックして、
クライアント様のeBay販売アカウントでログイン → 「許可する」を押してください。

【認可用URL】
https://script.google.com/macros/s/XXXXXXXXXXXXX/exec

完了後、画面に「認可が完了しました ✓」と表示されればOKです。
このURLは一度だけ使用します（次回以降は自動でトークン更新されます）。

ご不明な点がございましたらお問い合わせください。
```

### Step 5: クライアント認可完了の確認

- GAS スクリプトプロパティ `EBAY_REFRESH_TOKEN` に値がセットされていることを確認
- GAS エディタで `pollOrders` を1回手動実行
  - クライアントの実注文（過去7日分）が `orders` シートに入る
  - 翻訳結果も含まれていることを確認

### Step 6: 5分トリガーを稼働

GAS エディタで `installTriggers` 実行
- 「トリガー」画面で `pollOrders` `pollOffers` が 5分間隔登録されていることを確認

---

## 切替時のチェックリスト

Phase 2 → Phase 3 切替時に**漏れがちなポイント**:

- [ ] `EBAY_ENV` を `PRODUCTION` に変更したか
- [ ] `EBAY_REFRESH_TOKEN` を空欄に戻したか（Sandbox トークンが残っていると認可フローが Production の認可ではなく Sandbox の refresh で動いてしまう）
- [ ] App ID / Cert ID / Dev ID 全て Production 版に差し替えたか（Sandbox 値が混在するとエラー）
- [ ] Trading API の `EBAY_AUTH_TOKEN` も Production 版に差し替えたか（F-03 用、忘れがち）
- [ ] Discord Webhook を本番チャンネルに変更したか（テスト用のまま運用しないように）
- [ ] `TRADING_API_SITE_ID` がマーケットプレイスに合っているか（ebay.com=0, ebay.co.jp=104）

---

## ロールバック手順（Production で問題発生時）

### A. すぐ止める

GAS エディタで `uninstallTriggers` 実行 → 5分ポーリングが止まる。

### B. Sandbox に戻す

スクリプトプロパティで `EBAY_ENV` を `SANDBOX` に戻し、各 ID を Sandbox 値に差し替え。
`EBAY_REFRESH_TOKEN` も Sandbox 用に再認可（クライアント認可フローを再実施せず、Sandbox テストアカウントで自分が認可）。

### C. シート操作を止める

スクリプトプロパティ `SPREADSHEET_ID` を空白にすると、`getSheet()` が throw して全処理が即停止する（安全弁として使える）。

---

## RuName 設定でハマりやすいポイント

| 症状 | 原因 | 対処 |
|---|---|---|
| `invalid_request` エラー | `redirect_uri` パラメータに RuName ではなく生 URL を渡している | コードを確認、`getProp('EBAY_RU_NAME')` が RuName 文字列か |
| 認可後コールバックが届かない | Web App デプロイの「アクセスできるユーザー」が「自分のみ」になっている | 「全員」に変更して再デプロイ |
| eBay 同意画面が出ず即エラー | Sandbox の RuName を Production の認可URLで使っている（or 逆） | `EBAY_ENV` 設定値と RuName が整合しているか確認 |
| デプロイURLが古いまま固定されている | 「新しいデプロイ」を作って eBay 側未更新 | 「デプロイを管理」→ 既存デプロイの「バージョン」だけ更新する運用に統一 |
