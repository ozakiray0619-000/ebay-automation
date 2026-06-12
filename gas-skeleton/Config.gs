/**
 * Config.gs — システム定数とスクリプトプロパティアクセサ
 *
 * シークレット類は GAS スクリプトプロパティ（プロジェクト設定 → スクリプト プロパティ）
 * に保管し、コード内には書かない。
 *
 * 必要なスクリプトプロパティ:
 *   EBAY_APP_ID          : Application Key (Client ID)
 *   EBAY_CERT_ID         : Cert ID (Client Secret)
 *   EBAY_DEV_ID          : Dev ID（Trading API用）
 *   EBAY_RU_NAME         : Redirect URI Name
 *   EBAY_REFRESH_TOKEN   : OAuth 認可後に取得したリフレッシュトークン
 *   EBAY_AUTH_TOKEN      : Trading API 用 Auth'n'Auth トークン（F-03で使用）
 *   EBAY_DELETION_VERIFICATION_TOKEN : Account Deletion 通知エンドポイントの検証トークン（eBay開発者コンソールで取得）
 *   EBAY_ENV             : "SANDBOX" または "PRODUCTION"
 *   DISCORD_WEBHOOK_URL  : 本番Discord通知先
 *   SPREADSHEET_ID       : 出力先スプレッドシートID
 */

const CONFIG = Object.freeze({
  // ===== ポーリング設定 =====
  POLLING_INTERVAL_MINUTES: 5,
  INITIAL_FETCH_DAYS_BACK: 7,

  // ===== 翻訳設定 =====
  TRANSLATE_FROM: 'en',
  TRANSLATE_TO: 'ja',

  // ===== スプレッドシート =====
  SPREADSHEET_TITLE: 'eBay自動化データ', // 自動生成時のファイル名

  // ===== シート名 =====
  SHEET_ORDERS: 'orders',
  SHEET_OFFERS: 'offers',
  SHEET_LOGS: 'logs',

  // ===== ログローテーション =====
  LOGS_MAX_ROWS: 1000,

  // ===== eBay API エンドポイント =====
  EBAY_ENDPOINTS: {
    SANDBOX: {
      OAUTH:   'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
      REST:    'https://api.sandbox.ebay.com',
      TRADING: 'https://api.sandbox.ebay.com/ws/api.dll',
      AUTH_UI: 'https://auth.sandbox.ebay.com/oauth2/authorize'
    },
    PRODUCTION: {
      OAUTH:   'https://api.ebay.com/identity/v1/oauth2/token',
      REST:    'https://api.ebay.com',
      TRADING: 'https://api.ebay.com/ws/api.dll',
      AUTH_UI: 'https://auth.ebay.com/oauth2/authorize'
    }
  },

  // ===== OAuth スコープ =====
  OAUTH_SCOPES: [
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly'
  ],

  // ===== Trading API バージョン =====
  TRADING_API_COMPATIBILITY_LEVEL: '1193',
  TRADING_API_SITE_ID: '0', // 0 = US, 0=ebay.com, 100=eBay Motors。クライアント確認で確定
});

/** スクリプトプロパティを安全に取得（未設定なら例外） */
function getProp(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error(`Script property "${key}" is not set.`);
  return v;
}

/** 現在環境（SANDBOX/PRODUCTION）に応じたエンドポイント取得 */
function getEndpoints() {
  const env = (PropertiesService.getScriptProperties().getProperty('EBAY_ENV') || 'SANDBOX').toUpperCase();
  return CONFIG.EBAY_ENDPOINTS[env];
}

/**
 * PowerShell から clasp run で呼び出してAPIキーを一括登録する
 * 例: clasp run setApiKeys '["APP_ID","CERT_ID","DEV_ID","SANDBOX"]'
 */
function setApiKeys(appId, certId, devId, env) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('EBAY_APP_ID',  appId);
  props.setProperty('EBAY_CERT_ID', certId);
  props.setProperty('EBAY_DEV_ID',  devId);
  props.setProperty('EBAY_ENV',     env || 'SANDBOX');
  Logger.log('APIキーを登録しました (env=' + (env || 'SANDBOX') + ')');
  return 'OK';
}

/** 現在登録されているプロパティ一覧を返す（値はマスク） */
function checkProps() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const keys = ['EBAY_APP_ID','EBAY_CERT_ID','EBAY_DEV_ID','EBAY_ENV','EBAY_RU_NAME','EBAY_REFRESH_TOKEN','SPREADSHEET_ID','DISCORD_WEBHOOK_URL','EBAY_DELETION_VERIFICATION_TOKEN'];
  const result = {};
  keys.forEach(k => {
    const v = props[k];
    result[k] = v ? (k.includes('TOKEN') || k.includes('CERT') ? '***SET***' : v) : '(未設定)';
  });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
