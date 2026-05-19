# eBay自動化システム — GASプロジェクト雛形

## ファイル構成

| ファイル | 役割 |
|---|---|
| `appsscript.json` | GAS マニフェスト（タイムゾーン・スコープ・Web App設定） |
| `Config.gs` | 定数・スクリプトプロパティアクセサ |
| `OAuth.gs` | eBay OAuth 2.0 認可フロー（Web App） |
| `F01_Orders.gs` | F-01 注文取得 |
| `F02_Translate.gs` | F-02 翻訳（LanguageApp + キャッシュ） |
| `F03_Offers.gs` | F-03 Best Offer 取得 + Discord通知 |
| `SheetService.gs` | シートアクセス + 初回セットアップ `setupSheets()` |
| `LogService.gs` | logs シート書込 + 1000行ローテ |
| `DiscordService.gs` | Discord Webhook 投稿 |
| `Triggers.gs` | 5分トリガー設定 `installTriggers()` |
| `MockData.gs` | Phase 1 モック実行関数 |

## 初回セットアップ手順

1. **GAS プロジェクト作成**
   - 新規スプレッドシート → 拡張機能 → Apps Script
   - スクリプトIDをコピーして `clasp.json.sample` → `.clasp.json` にリネーム
2. **clasp で push**
   ```powershell
   npm i -g @google/clasp
   clasp login
   clasp push
   ```
3. **スクリプトプロパティを設定**（GASエディタ → 歯車 → スクリプトプロパティ）
   - `EBAY_APP_ID` / `EBAY_CERT_ID` / `EBAY_DEV_ID` / `EBAY_RU_NAME`
   - `EBAY_ENV` = `SANDBOX`
   - `SPREADSHEET_ID` = 紐付けたスプレッドシートID
   - `DISCORD_WEBHOOK_URL` = テスト用Webhook
4. **シート初期化**: `setupSheets` 関数を選択 → 実行
5. **Web App デプロイ**: デプロイ → 新しいデプロイ → 種類「ウェブアプリ」→ 全員アクセス可
   - 発行された URL を `EBAY_RU_NAME` に登録（eBay Developer ポータルでも同URLを設定）
6. **OAuth 認可**: クライアントへ Web App URL を送付 → 認可完了で `EBAY_REFRESH_TOKEN` がセットされる
7. **トリガー稼働**: `installTriggers` を実行

## Phase 1（モック）で動作確認する

API キー取得前でも以下が動きます:
```javascript
mockPollOrders();  // orders シートに2行追加
mockPollOffers();  // offers シートに1行追加 + Discord通知
```

`SPREADSHEET_ID` と `DISCORD_WEBHOOK_URL` だけ設定すればOK。
