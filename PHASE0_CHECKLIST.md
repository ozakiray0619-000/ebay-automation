# Phase 0 着手チェックリスト

> **基準日**: 2026-05-18 / **納期**: 2026年6月前半
> **最大のリスク**: Production Keyset 審査 3〜5営業日。今日中に動くと審査が 5/22〜5/25 に終わる想定。1日遅れるごとに Phase 3 が圧迫されます。

---

## 🔴 今日中（2026-05-18）

- [ ] **eBay Developers Program アカウント作成**
  - URL: <https://developer.ebay.com/signin>
  - 既存 eBay アカウントが無い場合は先に通常アカウント作成（クライアントのではなく開発者用）
  - 規約同意（API License Agreement）
- [ ] **Application Keys (Sandbox) を発行**
  - Developer Account → Application Keysets → Sandbox の「Create a keyset」
  - App ID / Dev ID / Cert ID / RuName をメモ
  - キーは GAS スクリプトプロパティに入れる前提で、まずローカルのパスワードマネージャに保管
- [ ] **OAuth Redirect URI (RuName) を Sandbox で設定**
  - Auth'n'Auth ではなく **User Token (OAuth 2.0)** を使う
  - Redirect URI は GAS の Web App URL（`/exec`）にする予定だが、Sandbox段階ではダミーURLで可

## 🟠 今週中（〜2026-05-22）

- [ ] **Production Keyset の申請を提出**
  - Sandbox keyset の隣にある「Apply for Production Keyset」ボタン
  - Compliance Questionnaire に回答（用途・ストレージ・PII取扱い）
  - **回答準備済テンプレ**:
    - 用途: 「Order management & buyer contact retrieval for a single seller (B2B internal tool)」
    - データ保存: Google Sheets (Google Workspace), encrypted at rest
    - 保持期間: 90日（業務処理完了後に削除）
    - 第三者共有: なし（販売者本人のみアクセス）
- [ ] **使用予定スコープを洗い出し**
  - `sell.fulfillment` (注文取得)
  - `sell.fulfillment.readonly` でも可
  - Trading API の `GetBestOffers` 用に Auth'n'Auth トークンが別途必要 → 認可フローを2系統にする想定
- [ ] **クライアントへ確認シート送付**（→ `CLIENT_INTAKE.md` 参照）

## 🟡 審査待ち期間に並行で進める（〜2026-05-25）

審査待ちでも止まらない。Phase 1（モック開発）を並行で：

- [ ] `clasp` インストール・GAS プロジェクト初期化
- [ ] スプレッドシート3シート（orders/offers/logs）作成
- [ ] ダミー JSON で F-01/F-02/F-03 のロジックを実装
- [ ] Discord Webhook をテスト用チャンネルで作成、通知の文面確定

→ 雛形コードは `gas-skeleton/` に生成済。

## ✅ Production Keyset 取得後（〜2026-05-31, Phase 2）

- [ ] Production Application Keys を GAS スクリプトプロパティへ移行
- [ ] OAuth 認可フロー（GAS Web App）を Production URL で再設定
- [ ] Sandbox トークンで動作確認 → Production トークンへ切替
- [ ] 5分間隔トリガー稼働、重複チェック動作確認

---

## 失敗パターンと回避策

| パターン | 回避策 |
|---|---|
| Compliance Questionnaire で reject | 「単一販売者の社内ツール」「データは販売者本人のみアクセス」「PII最小限保持」を明記。販売目的・他者再販なしを強調 |
| OAuth Redirect URI 不一致 | GAS Web App は deploy 時に URL 確定。Production 申請時のダミーURLは後で差し替え可能（再申請ではなく editing） |
| Trading API の GetBestOffers が REST に無い | 既知。Trading API は別認証系統（Auth'n'Auth）。GAS から XML POST で叩く前提でコード分離 |
| LanguageApp の日次クォータ超過 | GAS の `LanguageApp` は 1日あたり制限あり。商品名は orders シートにキャッシュして重複翻訳を回避（既に F-02 設計に含む） |
