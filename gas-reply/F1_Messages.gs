/**
 * F1 メッセージ受信
 *
 * eBay Trading API GetMyMessages で新着メッセージを取得し、正規化して返す。
 * 重複排除は MessageID で行う（_seen_messages 台帳）。
 *
 * 注意: Trading API は Auth'n'Auth トークンを使用（EBAY_AUTH_TOKEN）。
 */

/** 新着メッセージを取得して正規化済みオブジェクト配列で返す */
function fetchNewMessages() {
  const since = new Date(Date.now() - CONFIG.INITIAL_FETCH_DAYS_BACK * 24 * 60 * 60 * 1000);

  // Step 1: GetMyMessages (Summary→Headers) で MessageID 一覧を取得
  const headerXml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${getProp('EBAY_AUTH_TOKEN')}</eBayAuthToken></RequesterCredentials>
  <DetailLevel>ReturnHeaders</DetailLevel>
  <StartTime>${since.toISOString()}</StartTime>
  <EndTime>${new Date().toISOString()}</EndTime>
</GetMyMessagesRequest>`;

  const headerRes = callTrading_('GetMyMessages', headerXml);
  const ids = parseMessageIds_(headerRes);
  if (ids.length === 0) return [];

  // Step 2: 未処理IDだけに絞る
  const unseen = ids.filter(id => !isMessageSeen_(id));
  if (unseen.length === 0) return [];

  // Step 3: GetMyMessages (ReturnMessages) で本文取得（最大10件ずつ）
  const result = [];
  for (let i = 0; i < unseen.length; i += 10) {
    const batch = unseen.slice(i, i + 10);
    const bodyXml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${getProp('EBAY_AUTH_TOKEN')}</eBayAuthToken></RequesterCredentials>
  <DetailLevel>ReturnMessages</DetailLevel>
  <MessageIDs>
    ${batch.map(id => `<MessageID>${id}</MessageID>`).join('\n    ')}
  </MessageIDs>
</GetMyMessagesRequest>`;
    const bodyRes = callTrading_('GetMyMessages', bodyXml);
    parseMessages_(bodyRes).forEach(m => result.push(m));
  }
  return result;
}

/** Trading API 汎用呼び出し */
function callTrading_(callName, xml) {
  const endpoints = getEndpoints();
  const res = UrlFetchApp.fetch(endpoints.TRADING, {
    method: 'post',
    contentType: 'text/xml',
    headers: {
      'X-EBAY-API-COMPATIBILITY-LEVEL': CONFIG.TRADING_API_COMPATIBILITY_LEVEL,
      'X-EBAY-API-DEV-NAME':  getProp('EBAY_DEV_ID'),
      'X-EBAY-API-APP-NAME':  getProp('EBAY_APP_ID'),
      'X-EBAY-API-CERT-NAME': getProp('EBAY_CERT_ID'),
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-SITEID':    CONFIG.TRADING_API_SITE_ID
    },
    payload: xml,
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`${callName} ${res.getResponseCode()}: ${res.getContentText().slice(0, 500)}`);
  }
  return res.getContentText();
}

/** ReturnHeaders レスポンスから MessageID 一覧を抽出 */
function parseMessageIds_(xmlText) {
  const doc = XmlService.parse(xmlText);
  const root = doc.getRootElement();
  const ns = root.getNamespace();
  const messagesNode = root.getChild('Messages', ns);
  if (!messagesNode) return [];
  return messagesNode.getChildren('Message', ns)
    .map(m => { const c = m.getChild('MessageID', ns); return c ? c.getText() : ''; })
    .filter(Boolean);
}

/** ReturnMessages レスポンスから本文を正規化 */
function parseMessages_(xmlText) {
  const doc = XmlService.parse(xmlText);
  const root = doc.getRootElement();
  const ns = root.getNamespace();
  const messagesNode = root.getChild('Messages', ns);
  if (!messagesNode) return [];

  const textOf = (node, name) => {
    if (!node) return '';
    const c = node.getChild(name, ns);
    return c ? c.getText() : '';
  };

  return messagesNode.getChildren('Message', ns).map(m => ({
    messageId: textOf(m, 'MessageID'),
    sender:    textOf(m, 'Sender'),
    subject:   textOf(m, 'Subject'),
    body:      stripHtml_(textOf(m, 'Text') || textOf(m, 'Body')),
    receiveDate: textOf(m, 'ReceiveDate'),
    itemId:    textOf(m, 'ItemID'),
    // Order no. はメッセージ単体に無いことが多い。ItemID/件名から後段で解決
    orderId:   ''
  }));
}

/** 簡易HTML除去（メッセージ本文がHTMLで返るケース対策） */
function stripHtml_(s) {
  return String(s || '')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// ===== 重複排除台帳 =====

/** 処理済か判定 */
function isMessageSeen_(messageId) {
  const seen = seenMessageSet_();
  return seen.has(String(messageId));
}

/** 処理済として記録 */
function markMessageSeen_(messageId) {
  const sheet = getSheet(CONFIG.SHEET_SEEN);
  sheet.appendRow([String(messageId), new Date()]);
}

/** _seen_messages から ID の Set を構築 */
function seenMessageSet_() {
  const sheet = getSheet(CONFIG.SHEET_SEEN);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  return new Set(
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]))
  );
}
