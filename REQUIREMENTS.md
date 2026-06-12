# eBay 販売自動化システム 要件定義書

> **版数**: v1.0 / **作成日**: 2026-05-20 / **納期**: 2026年6月前半

---

## 1. プロジェクト概要

eBay 販売者（クライアント）の注文情報と Best Offer（値下げ交渉）を自動取得し、
Google スプレッドシートへ記録、英語の商品名を日本語へ翻訳し、新規オファーを
Discord へリアルタイム通知する受託開発案件。販売者の業務効率化を目的とする。

| 項目 | 内容 |
|---|---|
| 種別 | 受託開発（クライアント納品型） |
| クライアント | eBay 販売アカウント保有者 |
| 開発者 | れい（eBay Developers アカウントで API キーを取得する側） |
| 納期 | 2026年6月前半 |
| 開発環境 | Windows 11 + Cursor + clasp + Git |

---

## 2. システム構成

```
[eBay REST API]──┐
                 ├─→ [Google Apps Script]──→ [Google Sheets: orders/offers/logs]
[eBay Trading API]┘          │
                             └─→ [Discord Webhook]
```

| 構成要素 | 採用技術 | 備考 |
|---|---|---|
| 実行基盤 | Google Apps Script (V8) | サーバーレス、5分間隔トリガー |
| データ保管 | Google Sheets | orders / offers / logs の3シート |
| 翻訳 | `LanguageApp.translate()` | 無料。Cloud Translation は有料化済のため不採用 |
| 通知 | Discord Webhook | POST のみ |
| デプロイ | clasp | ローカル編集 → push。ビルド工程なし |
| シークレット管理 | GAS スクリプトプロパティ | コードに秘密情報を書かない |

**eBay API は2系統を併用:**
- REST Fulfillment API（OAuth 2.0）— 注文取得
- Trading API `GetBestOffers`（Auth'n'Auth XML）— オファー取得

---

## 3. 機能要件

### F-01: 購入履歴・連絡先取得
- eBay REST Fulfillment API から注文を取得し `orders` シートへ追記
- ポーリング間隔: 5分
- 初回起動時は過去7日分を取得
- 注文ID（orderId）で重複チェック。既存IDはスキップ
- 取得項目: 注文ID / 購入者名 / 購入者ID / 連絡先 / 商品名（原文・日本語）/ 金額 / 通貨 / 注文日時 / ステータス / 配送先国 / 取得日時

### F-02: 商品名・メッセージの英→日翻訳
- `LanguageApp.translate()` で英語→日本語
- 同一文字列の再翻訳を避けるため ScriptCache（6時間 TTL、MD5キー）でキャッシュ
- 翻訳失敗時は原文をそのまま返すフォールバック

### F-03: 新規 Best Offer の Discord 通知
- Trading API `GetBestOffers` で Active なオファーを取得し `offers` シートへ追記
- オファーID（offerId）で重複チェック
- 未通知のオファーを Discord へ送信
- `notifiedAt`（通知済フラグ）で冪等性を担保。通知済は再送しない

---

## 4. 非機能要件・制約

| 区分 | 要件 |
|---|---|
| 実行時間 | GAS の6分実行制限内に1回のポーリングを完了する |
| 翻訳クォータ | LanguageApp 日次上限を超えないようキャッシュ必須 |
| 環境切替 | `EBAY_ENV`（SANDBOX / PRODUCTION）でエンドポイントを切替 |
| ログ | logs シートに構造化ログ。1000行超で古い順に自動削除 |
| セキュリティ | API キー・トークンはスクリプトプロパティ管理。コードに直書きしない |
| 認可方式 | OAuth 2.0。クライアントは認可URLクリック1回のみ。アカウント共有は eBay TOS 違反のため不可 |
| データ保持 | 業務処理完了後90日で削除（Production申請の宣言値） |

---

## 5. データ設計

| シート | 列構成 |
|---|---|
| **orders**（12列） | 注文ID / 購入者名 / 購入者ID / 連絡先 / 商品名(原文) / 商品名(日本語) / 金額 / 通貨 / 注文日時 / ステータス / 配送先(国) / 取得日時 |
| **offers**（9列） | オファーID / 商品ID / 商品名(原文) / 商品名(日本語) / 購入者名 / オファー金額 / ステータス / 取得日時 / 通知済 |
| **logs**（4列） | timestamp / level(INFO/WARN/ERROR) / message / meta(JSON) |

---

## 6. フェーズ計画

| Phase | 内容 | 期間目安 |
|---|---|---|
| Phase 0 | 環境準備（Developer登録 → Sandbox → Production申請） | 5/18〜5/25 |
| Phase 1 | モック開発（ダミーJSONで動作確認） | 5/18〜5/25（並行） |
| Phase 2 | Sandbox 連携（実API・OAuth認可テスト） | 5/26〜5/31 |
| Phase 3 | Production 移行（クライアント認可・本番稼働） | 6/01〜6/10 |

---

## 7. 課題・リスク（2026-05-20 再検証）

> 「定義」と「コード雛形」は完成済。残る課題は **外部依存** と **未実行タスク** に集中している。

### 🔴 課題1: eBay Production Keyset が未申請（最大の課題 / クリティカルパス）

- **状態**: 仮アカウント `gkoinobori0505@gmail.com` は作成済だが、Developer 登録〜申請はまだ
- **影響**: 審査に3〜5営業日。今日(5/20)申請しても結果は 5/25〜5/27。これが Phase 2 以降すべての前提
- **なぜ課題か**: ここが遅れると Phase 3（本番移行・クライアント認可）が納期(6月前半)に間に合わなくなる
- **対応**: `EBAY_COMPLIANCE_TEMPLATE.md` の英文回答を使い、今日中に申請まで進める

### 🟠 課題2: クライアント確認5項目が未回答

- **未確定事項**:
  1. 対象マーケットプレイス（ebay.com / ebay.co.jp）→ Site ID が決まらず `Config.gs` の定数を確定できない
  2. アカウント種別（Store契約有無）→ 取得できる scope が変わる
  3. Best Offer の有効化状況 → F-03 の動作確認可否
  4. 本番 Discord Webhook URL
  5. OAuth 認可フロー実施の同意
- **なぜ課題か**: Phase 3 進行の必要条件。回答待ち時間が発生するので早く投げるほど良い
- **対応**: `CLIENT_MESSAGE.md` を今日送付

### 🟠 課題3: GAS Web App のデプロイ URL が未確定

- **影響**: OAuth Redirect URI（RuName）が確定しない
- **なぜ課題か**: RuName が確定しないと OAuth 認可フローが組めない
- **回避策**: Sandbox 段階はダミーURLで申請可能。後で editing で差し替え（再申請不要）
- **対応**: Phase 2 で `clasp deploy` し URL 確定 → eBay 側 RuName を更新（`RUNAME_SWITCHING_GUIDE.md`）

### 🟡 課題4: Trading API の実レスポンス構造が未検証

- **状態**: `F03_Offers.gs` の XML パースは修正済だが、実データでの階層は Sandbox/Production で要確認
- **なぜ課題か**: 想定と階層が違うとオファー取得が空振りする
- **対応**: フォールバック実装済。Phase 2 の実機テストで最終調整（`CODE_REVIEW_PHASE1.md` R-1）

### 🟡 課題5: OAuth CSRF 対策（state パラメータ）未実装

- **状態**: `OAuth.gs` に `state` 検証なし
- **なぜ課題か**: 単一クライアント運用なら実害は低いが、認可コード横取りの理論リスク
- **対応**: Phase 2 で実装（`CODE_REVIEW_PHASE1.md` R-2）

### 🟡 課題6: Trading API 用 Auth'n'Auth トークンが別途必要

- **状態**: OAuth 2.0 とは別系統。Developer Console で別途発行
- **なぜ課題か**: F-03（オファー通知）の動作にはこのトークンが必須。忘れやすい
- **対応**: Sandbox keyset 発行時に同時取得（Phase 0 のタスク 0-4）

---

## 8. 課題の依存関係まとめ

```
課題1（Production申請）─┬─→ Phase 2 全体が依存
                       └─→ 審査3-5営業日が全体スケジュールを律速

課題2（クライアント回答）─→ Phase 3 の前提 + 課題（マーケット未確定）を解消

課題3（Web App URL）───→ 課題（RuName未確定）を解消 → OAuth認可フロー成立

課題4・5・6 ──────────→ Phase 2 の実機テストで対応（コード側の残作業）
```

**最優先で着手すべきは課題1と課題2**（どちらも外部の待ち時間を生むため、今日中に動かす）。
コード側の課題4〜6は Phase 2 で順次対応すればよく、現時点でブロッカーではない。

---

## 9. 完成済み成果物（参照）

| ファイル | 内容 |
|---|---|
| `gas-skeleton/` | GAS コード雛形10ファイル（モック動作可、バグ修正済） |
| `CLIENT_MESSAGE.md` | クライアント送付用文面（課題2対応） |
| `EBAY_COMPLIANCE_TEMPLATE.md` | Production申請の英文回答（課題1対応） |
| `CLASP_DEPLOY_GUIDE.md` | clasp/GAS デプロイ手順（Phase 1対応） |
| `RUNAME_SWITCHING_GUIDE.md` | RuName 切替手順（課題3対応） |
| `CODE_REVIEW_PHASE1.md` | コードレビュー（課題4・5対応の詳細） |
| `PHASE_TRACKER.md` | 全47タスクの進捗管理表 |
