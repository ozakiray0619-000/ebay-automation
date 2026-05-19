/**
 * OAuth.gs — eBay OAuth 2.0 (REST API) のトークン管理
 *
 * フロー:
 *   1. doGet(): クライアントがアクセスする認可開始エンドポイント
 *   2. eBay の同意画面 → リダイレクトで code が返る
 *   3. exchangeCodeForTokens(): code → refresh_token + access_token に交換
 *   4. refresh_token をスクリプトプロパティに保存
 *   5. 以降、getAccessToken() が refresh_token から都度 access_token を再発行
 *
 * Trading API (F-03) は OAuth ではなく Auth'n'Auth トークンを別途使用。
 */

/** Web App エントリーポイント — クライアントが認可URLとして開く */
function doGet(e) {
  if (e && e.parameter && e.parameter.code) {
    // eBay からのコールバック
    return handleOAuthCallback(e.parameter.code);
  }
  // 初回アクセス: eBay の同意画面へ誘導
  return HtmlService.createHtmlOutput(`
    <h2>eBay 認可ページ</h2>
    <p>下のボタンをクリックして eBay にログインし、「許可する」を押してください。</p>
    <a href="${buildAuthorizationUrl()}" target="_blank"
       style="display:inline-block;padding:12px 24px;background:#0064d2;color:#fff;text-decoration:none;border-radius:4px;">
      eBay でログインして認可する
    </a>
  `);
}

/** 認可URLを構築 */
function buildAuthorizationUrl() {
  const endpoints = getEndpoints();
  const params = {
    client_id:     getProp('EBAY_APP_ID'),
    redirect_uri:  getProp('EBAY_RU_NAME'),
    response_type: 'code',
    scope:         CONFIG.OAUTH_SCOPES.join(' '),
    prompt:        'login'
  };
  const qs = Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  return `${endpoints.AUTH_UI}?${qs}`;
}

/** code → refresh_token 交換、保存 */
function handleOAuthCallback(code) {
  try {
    const tokens = exchangeCodeForTokens(code);
    PropertiesService.getScriptProperties().setProperty('EBAY_REFRESH_TOKEN', tokens.refresh_token);
    logInfo('OAuth callback success', { expires_in: tokens.expires_in });
    return HtmlService.createHtmlOutput('<h2>認可が完了しました ✓</h2><p>このタブは閉じてください。</p>');
  } catch (err) {
    logError('OAuth callback failed', { error: err.message });
    return HtmlService.createHtmlOutput(`<h2>エラー</h2><pre>${err.message}</pre>`);
  }
}

function exchangeCodeForTokens(code) {
  const endpoints = getEndpoints();
  const auth = Utilities.base64Encode(`${getProp('EBAY_APP_ID')}:${getProp('EBAY_CERT_ID')}`);
  const res = UrlFetchApp.fetch(endpoints.OAUTH, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: { Authorization: `Basic ${auth}` },
    payload: {
      grant_type:   'authorization_code',
      code:         code,
      redirect_uri: getProp('EBAY_RU_NAME')
    },
    muteHttpExceptions: true
  });
  const body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error(`Token exchange failed: ${res.getContentText()}`);
  return body;
}

/** refresh_token から access_token を取得（毎回再発行） */
function getAccessToken() {
  const endpoints = getEndpoints();
  const auth = Utilities.base64Encode(`${getProp('EBAY_APP_ID')}:${getProp('EBAY_CERT_ID')}`);
  const res = UrlFetchApp.fetch(endpoints.OAUTH, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: { Authorization: `Basic ${auth}` },
    payload: {
      grant_type:    'refresh_token',
      refresh_token: getProp('EBAY_REFRESH_TOKEN'),
      scope:         CONFIG.OAUTH_SCOPES.join(' ')
    },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`getAccessToken failed (${res.getResponseCode()}): ${res.getContentText()}`);
  }
  return JSON.parse(res.getContentText()).access_token;
}
