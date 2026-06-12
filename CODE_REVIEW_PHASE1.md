# gas-skeleton コードレビュー（Phase 1 着手前）

> **基準日**: 2026-05-20
> **対象**: `gas-skeleton/` 配下10ファイル
> **目的**: Phase 1（モック検証）開始前に阻害要因を潰し、Phase 2（Sandbox連携）への移行スムーズ化

---

## サマリ

| 重要度 | 件数 | 状態 |
|---|---|---|
| 🔴 バグ（動作阻害） | 1件 | ✅ 修正済 |
| 🟠 構造リスク（実機で要再確認） | 2件 | 📌 コメント追記 |
| 🟡 改善余地（影響軽微） | 3件 | 📋 メモ |
| ✅ OK | — | モック動作は問題なし |

**結論: モック検証（`mockPollOrders()` / `mockPollOffers()`）はそのまま実行可能。**

---

## 🔴 修正済: F03_Offers.gs parseBestOffersXml() のロジックバグ

### 修正前

```javascript
itemId: itemNode ? (itemNode.getChild('ItemID', ns) || {}).getText && itemNode.getChild('ItemID', ns).getText() : '',
```

### 問題

`getChild()` が `null` を返した場合、`(null || {})` で空オブジェクトに置換 → `{}.getText` は `undefined` → `undefined && ...` で **`undefined` を返してしまう**。意図は「無ければ空文字」だったはず。

加えて以下も問題:
- 同じ `getChild` を2回呼ぶ非効率
- 階層構造（`ItemBestOffersArray > ItemBestOffers > BestOfferArray > BestOffer`）が反映されていない

### 修正後

`textOf(parent, childName)` ヘルパで null セーフに、かつ正しい階層を踏破するパースに書き直し。
`ItemBestOffersArray` が無い場合は旧構造へフォールバック（破壊的変更を避けるため）。

詳細は `F03_Offers.gs` の `parseBestOffersXml()` を参照。

---

## 🟠 構造リスク（実機検証で要確認）

### R-1: Trading API GetBestOffers の実レスポンス階層

Sandbox / Production で実データを取得するまで、XML構造が100%正しいか確証なし。
- 階層が違ったら `extract()` 内のフィールド取得を再調整
- 確認手順: `pollOffers()` 実行後、`logs` シートで `fetchActiveBestOffers ok` の前にエラーが出ていないか確認
- もしエラーなら、レスポンス XML を `Logger.log()` で生で確認するスニペットを一時挿入

### R-2: OAuth CSRF対策 `state` パラメータ未実装

`buildAuthorizationUrl()` で `state` を発行・検証していない。**単一クライアント運用なら実害低いが**、Production 提出後に万一クライアントが認可URLを誤って他者と共有した場合、認可コード横取りリスクあり。

- 対応案: `state` に UUID + ScriptCache 保管 → コールバックで照合
- Phase 2 以降で実装推奨（モック検証には不要）

---

## 🟡 改善余地（影響軽微）

### I-1: `appsscript.json` に不要な scope

```json
"https://www.googleapis.com/auth/script.send_mail"
```

現状のコードでメール送信は使っていない。**最小権限の原則**から削除推奨。
ただし削除すると OAuth 同意画面の項目が変わるため、Production 認可済の後では再同意が必要になる。
→ **Phase 2 初回認可前に削除しておくのが安全**。

### I-2: F02_Translate.gs に「既に日本語」判定なし

日本語商品名（漢字・ひらがな・カタカナ）を翻訳API に投げると、ほぼ同じ文字列が返ってきて1クォータを消費する。

- 対応案: 入力に CJK 文字が含まれていればスキップ
- 必要かは商品名の多言語性次第。ebay.com（米）販売者なら不要、ebay.co.jp 併売なら必要
- **CLIENT_INTAKE Q1 の回答を見てから判断**

### I-3: F01_Orders.gs `creationdate` フィルタの日時形式

`Date.toISOString()` は `2026-05-20T00:00:00.000Z` を返すが、eBay は `2026-05-20T00:00:00.000Z` を許容する（ミリ秒部OK）。
ただし、過去の事例で **末尾 `Z` の代わりに `+00:00` を要求するケース報告**あり。Sandbox エラーが出たら以下に差し替え:

```javascript
const isoZ = since.toISOString().replace(/\.\d{3}Z$/, 'Z'); // ミリ秒部除去
```

---

## ✅ 問題なし（モック動作確認OK）

| ファイル | コメント |
|---|---|
| `Config.gs` | 定数構造OK、`getProp()` の throws 設計も妥当 |
| `OAuth.gs` | OAuth 2.0 認可フロー実装は正攻法。CSRF対策のみ別途 |
| `F01_Orders.gs` | 重複排除 + シート追記ロジックOK。モック動作可 |
| `F02_Translate.gs` | MD5 キャッシュキーOK、6h TTL妥当 |
| `SheetService.gs` | `setupSheets()` 冪等、フローズン行設定もOK |
| `LogService.gs` | ローテーション 1000行妥当、書込失敗が本処理を止めない設計OK |
| `DiscordService.gs` | Webhook 未設定時に logs スキップ動作OK（Phase 1向け） |
| `Triggers.gs` | 既存全削除→再作成の冪等パターンOK |
| `Menu.gs` | `onOpen()` で setup 自動実行 + メニュー追加OK |
| `MockData.gs` | 既存ロジック（`filterUnseenOrders` 等）を再利用、Phase 1検証に十分 |
| `appsscript.json` | timezone・runtime V8・oauthScopes ほぼ妥当（I-1のみ） |

---

## Phase 1 モック検証の推奨手順

1. 新規スプレッドシート作成 → 拡張機能 → Apps Script
2. `gas-skeleton/` 全ファイルを GAS エディタへ貼付（または `clasp push`）
3. スプレッドシートを開き直す → `🤖 eBay自動化` メニューが出る
4. メニュー → **▶ モック注文を生成** を実行
   - `orders` シートに2行追加されることを確認
   - `商品名(日本語)` 列に翻訳結果が入ることを確認
5. メニュー → **▶ モックオファーを生成** を実行
   - `offers` シートに1行追加
   - `通知済` 列が `TRUE` に更新される
   - `DISCORD_WEBHOOK_URL` 未設定なら `logs` シートに `Discord webhook not configured` が記録される
6. メニュー → **▶ モック注文を生成** を再実行
   - 既存IDは追加されないこと（重複排除動作）を確認

ここまで通れば Phase 1 完了。Sandbox keyset が降りたら Phase 2 へ移行。

---

## Phase 2 で着手する追加対応

| 項目 | 対象ファイル | 内容 |
|---|---|---|
| OAuth `state` パラメータ追加 | `OAuth.gs` | R-2 対応 |
| GetBestOffers レスポンス階層の最終調整 | `F03_Offers.gs` | R-1 対応 |
| 不要 scope 削除 | `appsscript.json` | I-1 対応 |
| 日本語スキップ翻訳 | `F02_Translate.gs` | I-2（Q1 回答次第） |
| `creationdate` フィルタの ISO 形式調整 | `F01_Orders.gs` | I-3（エラー出たら） |
