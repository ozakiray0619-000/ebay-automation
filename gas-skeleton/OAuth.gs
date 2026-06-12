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
  // eBay Marketplace Account Deletion 検証チャレンジ（本番キー有効化に必須）
  // eBay は ?challenge_code=XXX を GET で送ってくる → SHA-256 で応答する
  if (e && e.parameter && e.parameter.challenge_code) {
    return handleEbayDeletionChallenge(e.parameter.challenge_code);
  }
  if (e && e.parameter && e.parameter.code) {
    // eBay からのコールバック（state 検証あり）
    return handleOAuthCallback(e.parameter.code, e.parameter.state);
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

/**
 * eBay Marketplace Account Deletion 検証チャレンジ応答
 * https://developer.ebay.com/marketplace-account-deletion
 *
 * challengeResponse = SHA-256( challengeCode + verificationToken + endpointUrl )
 * を小文字16進数で返す。本番キー有効化の前提条件。
 */
function handleEbayDeletionChallenge(challengeCode) {
  const verificationToken = getProp('EBAY_DELETION_VERIFICATION_TOKEN');
  const endpoint = ScriptApp.getService().getUrl();
  const raw = challengeCode + verificationToken + endpoint;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  const hex = bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  return ContentService
    .createTextOutput(JSON.stringify({ challengeResponse: hex }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 認可URLを構築（CSRF対策のため state を生成・保存する） */
function buildAuthorizationUrl() {
  const endpoints = getEndpoints();

  // state: ランダム値をスクリプトプロパティに保存してコールバック時に照合
  const state = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      new Date().toISOString() + Math.random().toString())
  ).replace(/[+/=]/g, '').slice(0, 32);
  PropertiesService.getScriptProperties().setProperty('OAUTH_STATE', state);

  const params = {
    client_id:     getProp('EBAY_APP_ID'),
    redirect_uri:  getProp('EBAY_RU_NAME'),
    response_type: 'code',
    scope:         CONFIG.OAUTH_SCOPES.join(' '),
    prompt:        'login',
    state:         state
  };
  const qs = Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  return `${endpoints.AUTH_UI}?${qs}`;
}

/** code → refresh_token 交換、保存（state 検証つき） */
function handleOAuthCallback(code, state) {
  try {
    // CSRF チェック
    const savedState = PropertiesService.getScriptProperties().getProperty('OAUTH_STATE');
    if (!state || state !== savedState) {
      logError('OAuth callback: state mismatch', { received: state });
      return HtmlService.createHtmlOutput('<h2>エラー: 不正なリクエスト</h2><p>もう一度最初からやり直してください。</p>');
    }
    PropertiesService.getScriptProperties().deleteProperty('OAUTH_STATE'); // 使い捨て

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
