/**
 * Config.gs — eBay バイヤー返信システム（F1〜F4）
 *
 * シークレットは GAS スクリプトプロパティに保管。コードに直書きしない。
 *
 * 必要なスクリプトプロパティ:
 *   EBAY_DEV_ID          : Dev ID（Trading API）
 *   EBAY_APP_ID          : App ID（Trading API）
 *   EBAY_CERT_ID         : Cert ID（Trading API）
 *   EBAY_AUTH_TOKEN      : Trading API Auth'n'Auth トークン
 *   EBAY_ENV             : "SANDBOX" または "PRODUCTION"
 *   ANTHROPIC_API_KEY    : Claude API キー（しゅんすけ提供）
 *   DISCORD_WEBHOOK_URL  : Discord 通知先 Webhook
 *   SPREADSHEET_ID       : 記録先スプレッドシートID（任意。紐付き優先）
 *   --- F4: ワンクリック送信（リンク方式）---
 *   WEBAPP_URL           : デプロイしたウェブアプリの /exec URL（通知リンク生成に使用）
 *   F4_LINK_SECRET       : 通知リンクの簡易トークン（任意。f4GenerateSecret() で発行）
 *   F4_MOCK_SEND         : "false" で eBay 実送信。既定（未設定）は MOCK（実送信しない）
 *
 * デモ（モック）実行時は ANTHROPIC_API_KEY と DISCORD_WEBHOOK_URL だけあれば動く。
 * 両方未設定でも logs に出力されるため、完全オフラインでも処理フローは確認可能。
 */

const CONFIG = Object.freeze({
  // ===== ポーリング設定 =====
  POLLING_INTERVAL_MINUTES: 5,
  INITIAL_FETCH_DAYS_BACK: 3,

  // ===== シート名 =====
  SHEET_WORK: '在庫発送_作業',   // Order no. で紐付くメッセージの記録先（既存シート）
  SHEET_REPLY_LOG: '返信ログ',    // Order no. 未紐付メッセージの記録先（新設）
  SHEET_LOGS: 'logs',
  SHEET_SEEN: '_seen_messages',  // 重複排除用の処理済 MessageID 台帳

  // ===== ログローテーション =====
  LOGS_MAX_ROWS: 1000,

  // ===== eBay Trading API =====
  EBAY_ENDPOINTS: {
    SANDBOX:    { TRADING: 'https://api.sandbox.ebay.com/ws/api.dll' },
    PRODUCTION: { TRADING: 'https://api.ebay.com/ws/api.dll' }
  },
  TRADING_API_COMPATIBILITY_LEVEL: '1193',
  TRADING_API_SITE_ID: '0', // 0=US。クライアント確認で確定

  // ===== Claude API =====
  ANTHROPIC_ENDPOINT: 'https://api.anthropic.com/v1/messages',
  ANTHROPIC_VERSION:  '2023-06-01',
  ANTHROPIC_MODEL:    'claude-sonnet-4-6',
  ANTHROPIC_MAX_TOKENS: 1024,

  // ===== AI返信ポリシー =====
  REPLY_DEFAULT_LANG: 'auto', // バイヤーのメッセージ言語に合わせる
  REPLY_FEWSHOT_HISTORY: 5,   // 参照する過去やり取り件数の上限
});

/** スクリプトプロパティを安全に取得（未設定なら例外） */
function getProp(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error(`Script property "${key}" is not set.`);
  return v;
}

/** 任意プロパティ（未設定なら null、例外を投げない） */
function getPropOptional(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || null;
}

/** 現在環境に応じた eBay エンドポイント */
function getEndpoints() {
  const env = (getPropOptional('EBAY_ENV') || 'SANDBOX').toUpperCase();
  return CONFIG.EBAY_ENDPOINTS[env];
}
