# 実eBayテスト手順書（Sandbox）— gas-skeleton

最終更新: 2026-06-09 / 対象: F-01 注文取得・F-02 翻訳・F-03 オファー通知（Discord）

これまでのテストは全部モックデータ（MockData.gs）でした。この手順書は **本物のeBay API（Sandbox環境）に繋いで、注文/オファー取得と通知が実際に動くか** を確認するためのものです。本番アカウントを汚さずに試せます。

---

## 0. 事前メモ（重要な前提）

| 項目 | 値 |
|---|---|
| gas-skeleton scriptId（実機） | `1zUyMsNVjpcBM01pI_wo8L3auRilfR1jJz_mexFVMqzBJjt2AwShiUXYc` |
| 出力スプレッドシートID | `1yDFoG3RN5u84wg7f9kQZGVqpCfBQdxqi9Cme8Z_piHg` |
| eBay Developer | https://developer.ebay.com/my/keys |
| GASエディタ | https://script.google.com/home |

**テストは2段階に分けると確実です：**

- **レベル1（接続テスト・すぐできる）**: 実APIに認証だけ通して、注文/オファーが0件でもエラーなく返ってくることを確認。これだけで「認証情報・エンドポイント・通知パイプラインが本番でも生きている」ことが証明できる。
- **レベル2（取引込みのE2E）**: Sandboxにテスト出品→別ユーザーで購入/オファー、を発生させて実データで通知まで確認。手間はかかるが「本物の注文が流れる」完全確認。

まずレベル1から。詰まったら僕（チャット）に結果を貼ってください。

---

## 1. eBay Developer で値を確認（5分）

1. https://developer.ebay.com/my/keys を開く
2. **Production Keyset の審査状況**を確認（"Production" 側が有効になっていれば本番も選択肢に入る。まだなら Sandbox で進める）
3. **Sandbox** 側の以下3つを控える：
   - App ID (Client ID) → `EBAY_APP_ID`
   - Cert ID (Client Secret) → `EBAY_CERT_ID`
   - Dev ID → `EBAY_DEV_ID`

### ⚠️ RuName の落とし穴（必読）

OAuthの `redirect_uri` には **Webアプリの URL ではなく「RuName」**（`Rei_xxx-xxx-xxx-xxxxx` 形式の識別子）を入れます。コード（OAuth.gs）は `EBAY_RU_NAME` プロパティをそのまま `redirect_uri` に使うので、**ここには RuName 文字列を入れること**。URLを入れると認可で `invalid_request` になります。

- `EBAY_RU_NAME`（プロパティ） = **RuName 文字列**
- キーセット設定画面の "Your auth accepted URL"（eBay側の設定欄） = **GASウェブアプリの /exec URL**（eBayがここに `?code=...` を返してくる）

RuName・accepted URL は Developer → User Tokens → "Get a Token from eBay via Your Application" の設定画面で作成/確認できます。

---

## 2. GAS スクリプトプロパティを登録（10分）

GASエディタ → 左下「⚙ プロジェクトの設定」→「スクリプト プロパティ」で以下を登録：

| キー | 値 | 備考 |
|---|---|---|
| `EBAY_ENV` | `SANDBOX` | まずSandbox |
| `EBAY_APP_ID` | （手順1のApp ID） | |
| `EBAY_CERT_ID` | （手順1のCert ID） | |
| `EBAY_DEV_ID` | （手順1のDev ID） | F-03 Trading API用 |
| `EBAY_RU_NAME` | （RuName文字列） | ※URLではない |
| `SPREADSHEET_ID` | `1yDFoG3RN5u84wg7f9kQZGVqpCfBQdxqi9Cme8Z_piHg` | |
| `DISCORD_WEBHOOK_URL` | （テスト用Webhook） | 6/7に作った `ebay-test` のものでOK |

登録後、エディタで関数 **`checkProps`** を実行 → 実行ログに各プロパティが `***SET***` / 値 で出れば登録成功（`(未設定)` が無いか確認）。

---

## 3. OAuth 認可（REST注文取得用・5分）

1. GASエディタ →「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
   - 実行するユーザー: **自分**
   - アクセスできるユーザー: **全員**
   - デプロイ → 発行された **ウェブアプリURL（/exec）** を控える
2. その `/exec` URL を eBayキーセットの "auth accepted URL" に設定（手順1のRuNameに紐付け）
3. ブラウザで `/exec` URL を開く → 「eBayでログインして認可する」ボタン → **Sandboxテストユーザー**でログイン → 「同意」
4. 「認可が完了しました ✓」が出ればOK。`EBAY_REFRESH_TOKEN` が自動保存される

> うまくいかない時は GASの「実行数」ログか logsシートに `OAuth callback failed` が出ていないか確認。

---

## 4. レベル1：接続テスト（注文側 F-01）

GASエディタで以下を順に実行：

1. **`getAccessToken`** を実行 → 実行ログにアクセストークン（長い文字列）が返ればOAuth成功
2. **`pollOrders`** を実行
   - 注文があれば orders シートに追記、無ければ logsシートに `No new orders`
   - **どちらでも「エラーが出ない」=実APIの認証・エンドポイントが本番で生きている証明**
   - logsシートに `fetchRecentOrders ok` が出ていれば成功

---

## 5. レベル1：接続テスト（オファー側 F-03）

F-03は Trading API（Auth'n'Auth）なので別トークンが必要です。

1. Developer → "User Tokens (Auth'n'Auth)" → **Sandbox** → サインインしてトークン生成
2. そのトークンを `EBAY_AUTH_TOKEN` プロパティに登録
3. GASエディタで **`pollOffers`** を実行
   - オファーがあれば offersシート追記＋Discord通知、無ければエラーなく完了
   - logsシートに `fetchActiveBestOffers ok` が出れば成功

> ⚠️ 実オファーが返ってきた場合、`parseBestOffersXml` のXML階層が実データと合わず空になる可能性あり。その時はレスポンスXMLをチャットに貼ってくれれば僕が階層を直します。

---

## 6. レベル2：取引込みE2E（任意・時間がある時）

Sandboxで実データを流す完全テスト。手間がかかるので、レベル1が通ってからで十分です。

1. Sandboxテストユーザーを2人作成（Developer → Sandbox → Test Users）
2. ユーザーAで商品を出品（Best Offer有効に）
3. ユーザーBで購入（→ F-01 注文）またはオファー送信（→ F-03 オファー）
4. `pollOrders` / `pollOffers` を実行 → シート書込＋Discord通知を確認
5. もう一度実行して **二重に書き込まれない**（重複防止）ことも確認

---

## 7. 終わったら

- うまくいったら WORK_LOG.md の Phase 2 チェックボックスを更新
- レベル1が通れば「実API接続OK」、レベル2まで通れば「E2E確認済み」
- 本番移行は Production Keyset 審査完了後に `EBAY_ENV=PRODUCTION` ＋本番トークンで同じ流れ

---

## つまずきポイント早見表

| 症状 | 原因/対処 |
|---|---|
| 認可で `invalid_request` | `EBAY_RU_NAME` にURLを入れている → RuName文字列に直す |
| `getAccessToken failed (401)` | App ID/Cert IDの誤り、または `EBAY_ENV` とトークンの環境不一致 |
| `Script property "X" is not set` | 手順2の登録漏れ。`checkProps` で確認 |
| Discord来ない | `DISCORD_WEBHOOK_URL` 未設定、または offersの「通知済」が既にTRUE |
| オファーが空になる | `parseBestOffersXml` のXML階層ズレ → レスポンスを僕に共有 |
