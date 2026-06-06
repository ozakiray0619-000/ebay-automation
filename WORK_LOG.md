# eBay自動化システム — 作業ログ

最終更新: 2026-06-07

---

## プロジェクト概要

| 項目 | 内容 |
|---|---|
| プロジェクト名 | eBay自動化システム |
| 開発者 | れい |
| クライアント | eBayアカウント保有者（販売者） |
| 納期 | 2026年6月前半 |
| GitHub | https://github.com/ozakiray0619-000/ebay-automation |
| GAS scriptId | `1ZlqIjOduaaBlvCyqA8uH4w9xQ2zHPCj23aMPkql3wFaxpk-TEETufkc8` |
| 開発スタック | Google Apps Script + Google Sheets + Discord Webhook + Cursor + clasp + PowerShell |

---

## 機能要件

| ID | 機能 | 担当ファイル | 状態 |
|---|---|---|---|
| F-01 | 注文情報の自動取得・Sheets記録（5分ポーリング） | gas-skeleton / F01_Orders.gs | ✅ モック動作確認済(2026-06-07) |
| F-02 | 英→日 自動翻訳（LanguageApp） | gas-skeleton / F02_Translate.gs | ✅ モック動作確認済（商品名が日本語化） |
| F-03 | Best Offer の Discord 通知 | gas-skeleton / F03_Offers.gs | ✅ Discord実通知 着弾確認済(2026-06-07) |
| F1 | バイヤーメッセージ取得 | gas-reply / F1_Messages.gs | ✅ モック動作確認済(2026-06-07) |
| F2 | AI返信案生成（Claude API） | gas-reply / F2_AIReply.gs | ⏸ パイプラインOK・ANTHROPIC_API_KEY未設定でプレースホルダ |
| F3 | Discord 通知（Webhook） | gas-reply / F3_Discord.gs | ✅ Discord実通知 着弾確認済(2026-06-07) |
| F4 | ワンクリック返信送信（Discord Bot） | 未実装 | 🔜 次フェーズ（次回の最優先タスク） |

---

## 開発フェーズ

### Phase 0 — 環境準備（完了）

- [x] eBay 一般アカウント作成（開発専用）
- [x] eBay Developers Program 登録
- [x] Sandbox キー発行（App ID / Cert ID / Dev ID）
- [x] Production Keyset 申請（審査中 3〜5営業日）
- [x] Discord アカウント確認・開発用サーバー作成
- [x] Node.js インストール
- [x] clasp インストール・ログイン（`clasp login`）
- [x] Apps Script API 有効化
- [x] GitHub リポジトリ作成・コード push 済み
- [x] Cursor インストール・セットアップ

### Phase 1 — モック開発（進行中）

- [x] gas-skeleton（F01〜F03）コード一式完成・clasp push 済み
- [x] gas-reply（F1〜F3）コード一式完成・clasp push 済み
- [x] setup.bat / setup.ps1 / run.ps1 によるワンコマンド環境構築スクリプト完成
- [x] CLAUDE.md によるプロジェクト仕様の記述完成
- [x] `bootstrap()` / `setupSheets()` の実行（スプレッドシート自動生成）✅2026-06-07
- [x] `mockPollOrders()` 動作確認（orders シート書込OK）✅2026-06-07
- [x] `mockPollOffers()` 動作確認（offers シート書込OK）✅2026-06-07
- [x] `mockPollMessages()` 動作確認（返信ログ記録＋Discord通知）✅2026-06-07
- [x] Discord Webhook 通知の到達確認（🎯新規Best Offer / 📨新着バイヤーメッセージ 着弾）✅2026-06-07

### Phase 2 — Sandbox 連携（未着手）

- [ ] eBay OAuth 認可フロー実機テスト
- [ ] Sandbox テストユーザー作成
- [ ] Fulfillment API 注文取得テスト
- [ ] Trading API GetBestOffers テスト
- [ ] エンドツーエンド（取得→翻訳→書込→通知）確認

### Phase 3 — Production 移行（未着手）

- [ ] Production Keyset 審査完了確認
- [ ] エンドポイント切り替え（sandbox → api.ebay.com）
- [ ] クライアントへ OAuth 認可 URL 送付
- [ ] 本番データ3日連続稼働確認
- [ ] 納品ドキュメント提出

---

## セッション別作業記録

### [2026-05-初旬] 要件定義・システム設計

- eBay販売自動化の要件定義を実施
- 3機能（F-01注文取得 / F-02翻訳 / F-03オファー通知）を確定
- アーキテクチャ設計：GAS + Google Sheets + Discord Webhook
- eBay API 2系統（REST Fulfillment + Trading XML）の採用決定
- 重要技術判断：LanguageApp.translate()（無料）採用、Cloud Translation APIは有料のため却下
- OAuth方式：クライアントはURLクリック1回のみ、ID/パスワード共有はTOS違反のためNG
- メールアドレスはeBay APIから取得不可（個人情報保護）→ buyerCheckoutNotes で代替

### [2026-05-中旬] gas-skeleton 開発

- GASコード一式を作成（9ファイル）：Config.gs / OAuth.gs / F01_Orders.gs / F02_Translate.gs / F03_Offers.gs / SheetService.gs / LogService.gs / DiscordService.gs / Triggers.gs / Menu.gs / MockData.gs
- clasp push で GAS にアップロード完了（scriptId: `1ZlqIjOduaaBlvCyqA8uH4w9xQ2zHPCj23aMPkql3wFaxpk-TEETufkc8`）
- スプレッドシート設計（orders / offers / logs シート）
- モックデータ（MockData.gs）完成
- OAuth.gs に CSRF 対策（state パラメータ）追加
- F02_Translate.gs に日本語スキップ処理追加（LanguageApp クォータ節約）

### [2026-05-中旬] gas-reply 開発

- 返信BOT用 GAS コード一式を作成（gas-reply/）
- F1_Messages.gs（メッセージ取得）/ F2_AIReply.gs（Claude AI返信案生成）/ F3_Discord.gs（Discord通知）
- eBay返信BOT_全部入り.gs → 9ファイル構成に分割
- SheetService.gs の構文エラー（途中で切れていた）を修正
- clasp push 完了

### [2026-05-中旬] GitHub・ツールセットアップ

- GitHub リポジトリ `ozakiray0619-000/ebay-automation` 作成（Public）
- Git / GitHub CLI / Claude Code の導入スクリプト（setup.bat / setup.ps1）作成
- CLAUDE.md プロジェクト仕様書作成
- スタートアップガイド START_HERE.md 作成
- セットアップガイド（.docx）作成

### [2026-05-下旬] Cursor トラブルシューティング

- Cursor が開かない問題対応
- 別ファイルをCursor内で開いてしまい、移行・再インストールが発生
- データ（プロジェクトファイル・Cursor設定）は全て無事を PowerShell で確認
- `$env:APPDATA\Cursor\User` の設定フォルダ、OneDriveのプロジェクトファイル共に保全確認済み

### [2026-06-07] 実機モックテスト一斉実施・Discord実通知確認

- eBay Developer で App keyset を作成し App ID / Dev ID / Cert ID を取得（Cert IDは保管）。Production審査の結果確認は未（developer.ebay.com/my/keys で要確認）。
- **gas-skeleton 実機確認**（scriptId `1zUyMsNVjpcBM01pI_wo8L3auRilfR1jJz_mexFVMqzBJjt2AwShiUXYc`）:
  - `bootstrap()` でスプレッドシート自動生成（id `1yDFoG3RN5u84wg7f9kQZGVqpCfBQdxqi9Cme8Z_piHg`）
  - `mockPollOrders()` / `mockPollOffers()` → orders/offers シート書込OK、F-02翻訳で商品名が日本語化
- **F-03 Discord通知 実物テスト成功**: Discordサーバー `ebay-test` に Webhook作成 → スクリプトプロパティ `DISCORD_WEBHOOK_URL` 設定 → 「通知済」クリア後 `mockPollOffers()` 再実行 → 🎯新規Best Offer がDiscordに着弾
- **gas-reply 実機確認**（scriptId `1QbXsV2bGtYRvwNRMfA3oCZa8UDud1A5BCr6UdAWNYtMFH2Do-jSkjCps`）:
  - `setupSheets()` で専用スプレッドシート生成、`DISCORD_WEBHOOK_URL` をこのプロジェクトにも設定（プロパティはプロジェクト毎に別管理）
  - `mockPollMessages()` → 📨新着バイヤーメッセージがDiscordに通知＋`返信ログ`記録。F2のAI返信案は `ANTHROPIC_API_KEY` 未設定のためプレースホルダ表示
- **F4（ワンクリック送信）が未実装であることを確認**。Webhookは投稿専用でボタン受信不可 → Discord Bot(Application)+Interactions Endpoint+Ed25519署名検証 が必要（REQUIREMENTS_buyer_reply.md 参照）

> ⚠️ scriptID注意: 本ログ上部の旧記載 `1ZlqIjOD...` と、今日実機で使った `1zUyMsNV...` は別プロジェクト。今後は `1zUyMsNV...`（gas-skeleton）と `1QbXsV2b...`（gas-reply）を正とする。

---

## 次にやること（最優先）

1. **【次回の最優先】F4 ワンクリック送信の実装＋テスト**
   - Discord Bot（Application）作成・サーバー登録
   - ボタン押下を受けるInteractions Endpoint＋Ed25519署名検証（GASでは重い→Cloud Run等の代替も検討）
   - eBay送信API: 返信=`AddMemberMessageRTQ` / オファー=`RespondToBestOffer`
   - 二重送信防止（送信済ボタンの無効化）

2. **F2 本番化**: gas-reply に `ANTHROPIC_API_KEY`（しゅんすけ提供）を設定し、本物のAI返信案生成を確認

3. **Production Keyset 審査結果の確認**（developer.ebay.com/my/keys）

4. **進捗のGitHub保存**: 更新したWORK_LOG等を `ozakiray0619-000/ebay-automation` へ push（ユーザーPCから）

---

## クライアントから受領が必要なもの

| タイミング | 内容 |
|---|---|
| Phase 1 開始時 | 対象マーケット / アカウント種別 / Best Offer 有効化状況 |
| Phase 3 直前 | OAuth 認可（URLクリック） / 本番Discord Webhook URL |

---

## 重要な設定・URL

| 項目 | 値 |
|---|---|
| GAS scriptId | `1ZlqIjOduaaBlvCyqA8uH4w9xQ2zHPCj23aMPkql3wFaxpk-TEETufkc8` |
| GitHub | https://github.com/ozakiray0619-000/ebay-automation |
| GAS エディタ | https://script.google.com/home |
| eBay Developer Portal | https://developer.ebay.com/my/keys |
| Discord Developer Portal | https://discord.com/developers/applications |

---

## 重要な制約

- GAS実行時間制限：6分以内（設計済み）
- 翻訳キャッシュ：ScriptCache、6時間TTL、MD5キー（クォータ節約）
- `EBAY_ENV` プロパティでsandbox / production を切り替え
- `.clasp.json` と `EBAY_REFRESH_TOKEN` は `.gitignore` 済み（絶対にコミットしない）
