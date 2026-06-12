/**
 * eBay バイヤー返信システム（F1〜F3 デモ版） — 全部入り単一ファイル
 * このファイル1つを GAS エディタの コード.gs に貼り付ければ動きます。
 * 構成: Config/Log/Sheet/F1/F2/F3/Main/Mock/Menu を結合。
 */

// ============================================================
// ===== Config.gs =====
// ============================================================
/**
 * Config.gs — eBay バイヤー返信システム（F1〜F3 デモ版）
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


// ============================================================
// ===== LogService.gs =====
// ============================================================
/**
 * LogService.gs — logs シートへの構造化ログ + 1000行ローテーション
 */

function logInfo(message, meta)  { writeLog_('INFO',  message, meta); }
function logWarn(message, meta)  { writeLog_('WARN',  message, meta); }
function logError(message, meta) { writeLog_('ERROR', message, meta); }

function writeLog_(level, message, meta) {
  try {
    const sheet = getSheet(CONFIG.SHEET_LOGS);
    sheet.appendRow([
      new Date(),
      level,
      String(message || ''),
      meta ? JSON.stringify(meta) : ''
    ]);
    rotateLogsIfNeeded_(sheet);
  } catch (err) {
    Logger.log(`[writeLog_ failed] ${err.message}`);
  }
}

function rotateLogsIfNeeded_(sheet) {
  const lastRow = sheet.getLastRow();
  const dataRows = lastRow - 1;
  if (dataRows > CONFIG.LOGS_MAX_ROWS) {
    sheet.deleteRows(2, dataRows - CONFIG.LOGS_MAX_ROWS);
  }
}


// ============================================================
// ===== SheetService.gs =====
// ============================================================
/**
 * SheetService.gs — シートアクセス + 初回セットアップ
 *
 * シート:
 *   在庫発送_作業 : 既存シート。Order no. に紐付くメッセージのAI返信案/送信ログを追記
 *   返信ログ      : 新設。Order no. 未紐付（取引前の質問）を記録
 *   logs          : 構造化ログ
 *   _seen_messages: 重複排除用の処理済MessageID台帳
 */

function openSpreadsheet() {
  // 1. バインドされたスプレッドシートがあれば最優先
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  // 2. SPREADSHEET_ID プロパティがあればそれを開く
  const id = getPropOptional('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); }
    catch (e) { Logger.log('保存済IDが無効 — 新規作成します: ' + e.message); }
  }
  // 3. どちらも無ければ新規スプレッドシートを自動作成し、IDを記憶
  const ss = SpreadsheetApp.create('eBay返信BOT_データ');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('新規スプレッドシートを自動作成: ' + ss.getUrl());
  return ss;
}

/** 記録先スプレッドシートのURLをログに出す（実行→ログで開ける） */
function showSpreadsheetUrl() {
  const ss = openSpreadsheet();
  const url = ss.getUrl();
  Logger.log('スプレッドシート: ' + url);
  return url;
}

function getSheet(name) {
  const ss = openSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found. Run setupSheets() first.`);
  return sheet;
}

/** 初回セットアップ: 必要シートをヘッダ付きで作成（冪等） */
function setupSheets() {
  const ss = openSpreadsheet();

  // 返信ログ（新設）— Order no. 未紐付メッセージ用
  ensureSheetWithHeaders_(ss, CONFIG.SHEET_REPLY_LOG, [
    'メッセージID', '受信日時', 'バイヤーID', '件名', '本文',
    'AI返信案', '送信した返信文', '送信日時', 'オファー判断'
  ]);

  // logs
  ensureSheetWithHeaders_(ss, CONFIG.SHEET_LOGS, [
    'timestamp', 'level', 'message', 'meta'
  ]);

  // _seen_messages（重複排除台帳）
  ensureSheetWithHeaders_(ss, CONFIG.SHEET_SEEN, [
    'メッセージID', '処理日時'
  ]);

  // 在庫発送_作業 が無ければ最小ヘッダで作る（本番は既存シートを使う想定）
  if (!ss.getSheetByName(CONFIG.SHEET_WORK)) {
    ensureSheetWithHeaders_(ss, CONFIG.SHEET_WORK, [
      'Order no.', '最終バイヤーメッセージ', 'AI返信案',
      '送信した返信文', '送信日時', 'オファー判断'
    ]);
  } else {
    // 既存シートに不足列を右端へ追加
    ensureColumns_(ss.getSheetByName(CONFIG.SHEET_WORK), [
      '最終バイヤーメッセージ', 'AI返信案', '送信した返信文', '送信日時', 'オファー判断'
    ]);
  }

  Logger.log('setupSheets: complete');
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some(c => c !== '');
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

/** 既存シートのヘッダ行に、無い列名だけを右端へ追加 */
function ensureColumns_(sheet, columnNames) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  let cursor = lastCol;
  columnNames.forEach(function (name) {
    if (header.indexOf(name) === -1) {
      cursor += 1;
      sheet.getRange(1, cursor).setValue(name).setFontWeight('bold');
    }
  });
}

/** ヘッダ名 → 列番号(1始まり) のマップを返す */
function headerIndexMap(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  header.forEach(function (h, i) { if (h !== '') map[String(h)] = i + 1; });
  return map;
}


// ============================================================
// ===== F1_Messages.gs =====
// ============================================================
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


// ============================================================
// ===== F2_AIReply.gs =====
// ============================================================
/**
 * F2 AI返信案生成（Claude API）
 *
 * バイヤーのメッセージ + 過去のやり取りを元に、Claude API で返信案を生成する。
 * - 返信言語はバイヤーのメッセージ言語に合わせる（プロンプトで指示）
 * - トーンは丁寧・簡潔な eBay セラー
 * - 過去返信を few-shot として渡し、青田さんの文体に寄せる
 * - 自動送信はしない（生成のみ。送信は人間がDiscordで承認＝F4、デモ範囲外）
 */

/**
 * 返信案を生成して文字列で返す。失敗時は空文字 + ログ。
 * @param {Object} message 正規化済みメッセージ {sender, subject, body, ...}
 * @param {Array<Object>} history 過去やり取り [{role:'buyer'|'seller', text}]
 */
function generateReplyDraft(message, history) {
  const apiKey = getPropOptional('ANTHROPIC_API_KEY');
  if (!apiKey) {
    logWarn('ANTHROPIC_API_KEY 未設定 — AI返信案生成をスキップ', { messageId: message.messageId });
    return '(AI返信案: ANTHROPIC_API_KEY 未設定のためスキップ)';
  }

  const systemPrompt = buildSystemPrompt_();
  const userPrompt = buildUserPrompt_(message, history || []);

  try {
    const res = UrlFetchApp.fetch(CONFIG.ANTHROPIC_ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': CONFIG.ANTHROPIC_VERSION
      },
      payload: JSON.stringify({
        model: CONFIG.ANTHROPIC_MODEL,
        max_tokens: CONFIG.ANTHROPIC_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      logError('Claude API エラー', { code: code, body: res.getContentText().slice(0, 300) });
      return '(AI返信案: 生成エラー。手動で返信してください)';
    }
    const data = JSON.parse(res.getContentText());
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
    return text || '(AI返信案: 空の応答)';
  } catch (err) {
    logError('generateReplyDraft 失敗', { error: err.message, messageId: message.messageId });
    return '(AI返信案: 生成エラー。手動で返信してください)';
  }
}

/** システムプロンプト（役割・トーン・制約） */
function buildSystemPrompt_() {
  return [
    'You are an assistant drafting customer-service replies for an eBay seller.',
    'Rules:',
    '- Reply in the SAME language as the buyer\'s latest message (e.g. English buyer -> English reply).',
    '- Tone: polite, concise, professional, friendly. Match the seller\'s past style if examples are provided.',
    '- Do NOT invent facts (shipping dates, tracking numbers, stock) that are not given. If unknown, use a safe placeholder like "[please confirm]".',
    '- Keep it brief: 2-5 sentences unless the buyer asked something complex.',
    '- Output ONLY the reply text. No preamble, no quotes, no explanation.'
  ].join('\n');
}

/** ユーザープロンプト（履歴 few-shot + 今回のメッセージ） */
function buildUserPrompt_(message, history) {
  const lines = [];
  if (history.length > 0) {
    lines.push('# Past conversation (most recent last):');
    history.slice(-CONFIG.REPLY_FEWSHOT_HISTORY).forEach(h => {
      const who = h.role === 'seller' ? 'Seller' : 'Buyer';
      lines.push(`${who}: ${h.text}`);
    });
    lines.push('');
  }
  lines.push('# Buyer\'s latest message to reply to:');
  if (message.subject) lines.push(`Subject: ${message.subject}`);
  lines.push(`From: ${message.sender || 'buyer'}`);
  lines.push(`Message: ${message.body || ''}`);
  lines.push('');
  lines.push('Draft the seller\'s reply now.');
  return lines.join('\n');
}


// ============================================================
// ===== F3_Discord.gs =====
// ============================================================
/**
 * F3 Discord通知
 *
 * 「誰から / 何が来た / AI返信案」を Discord へ投稿する。
 *
 * デモ範囲（F1〜F3）では Webhook で通知のみ。
 * ボタン操作によるワンクリック送信（F4）は Discord Bot + Interactions Endpoint が
 * 必要になるため、本デモではスコープ外。通知メッセージ末尾にその旨を明記する。
 */

/** 1件のメッセージ + AI返信案を Discord へ通知 */
function notifyToDiscord(message, replyDraft) {
  const content = buildDiscordContent_(message, replyDraft);
  postToDiscord_(content);
}

function buildDiscordContent_(message, replyDraft) {
  const order = message.orderId ? `**Order:** ${message.orderId}\n` : '';
  const item = message.itemId ? `**Item:** ${message.itemId}\n` : '';
  // Discord は2000文字制限。本文と返信案を安全長に丸める
  const body = truncate_(message.body, 600);
  const draft = truncate_(replyDraft, 900);
  return [
    '📩 **新着バイヤーメッセージ**',
    `**From:** ${message.sender || '(unknown)'}`,
    message.subject ? `**件名:** ${message.subject}` : '',
    order + item,
    '**メッセージ本文:**',
    '> ' + body.replace(/\n/g, '\n> '),
    '',
    '🤖 **AI返信案:**',
    '```',
    draft,
    '```',
    '_※ 送信ボタン（ワンクリック送信）は次フェーズで実装予定。現在は通知のみ。_'
  ].filter(s => s !== '').join('\n');
}

function truncate_(s, max) {
  s = String(s || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Discord Webhook へ POST。未設定なら logs に出力（オフラインでもフロー確認可） */
function postToDiscord_(content) {
  const url = getPropOptional('DISCORD_WEBHOOK_URL');
  if (!url) {
    logInfo('Discord webhook 未設定 — 通知内容を logs に出力', { content: truncate_(content, 500) });
    return;
  }
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ content: content }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code !== 204 && code !== 200) {
    throw new Error(`Discord webhook ${code}: ${res.getContentText()}`);
  }
}


// ============================================================
// ===== Main.gs =====
// ============================================================
/**
 * Main.gs — F1〜F3 オーケストレーション
 *
 * フロー:
 *   1. fetchNewMessages()    … F1 新着取得（重複排除済）
 *   2. generateReplyDraft()  … F2 AI返信案生成
 *   3. notifyToDiscord()     … F3 Discord通知
 *   4. recordMessage()       … スプシ記録 + 処理済マーク
 *
 * デモは mockPollMessages()（MockData.gs）から呼ぶ。本番は pollMessages()。
 */

/** 本番: eBay から取得して処理 */
function pollMessages() {
  try {
    const messages = fetchNewMessages();
    logInfo('fetchNewMessages ok', { count: messages.length });
    processMessages_(messages);
  } catch (err) {
    logError('pollMessages failed', { error: err.message, stack: err.stack });
  }
}

/** 取得済みメッセージ配列を F2→F3→記録 まで処理（本番/モック共通） */
function processMessages_(messages) {
  if (!messages || messages.length === 0) {
    logInfo('処理対象メッセージなし');
    return;
  }
  messages.forEach(msg => {
    try {
      const history = loadHistoryFor_(msg);          // 過去やり取り（任意）
      const draft = generateReplyDraft(msg, history); // F2
      notifyToDiscord(msg, draft);                    // F3
      recordMessage_(msg, draft);                     // スプシ記録
      markMessageSeen_(msg.messageId);                // 重複排除マーク
      logInfo('メッセージ処理完了', { messageId: msg.messageId, sender: msg.sender });
    } catch (err) {
      logError('メッセージ処理失敗', { messageId: msg.messageId, error: err.message });
    }
  });
}

/**
 * 過去やり取りの読み込み。
 * デモ段階ではスプシからの履歴復元は未実装（空配列）。
 * 本番で在庫発送_作業 / 返信ログ から同一バイヤー分を引く拡張ポイント。
 */
function loadHistoryFor_(msg) {
  return [];
}

/**
 * スプシへ記録。
 * Order no. が紐付くものは 在庫発送_作業 へ、無いものは 返信ログ へ。
 */
function recordMessage_(msg, draft) {
  if (msg.orderId) {
    recordToWorkSheet_(msg, draft);
  } else {
    recordToReplyLog_(msg, draft);
  }
}

/** 在庫発送_作業: Order no. 一致行に AI返信案等を書き込む（無ければ追記） */
function recordToWorkSheet_(msg, draft) {
  const sheet = getSheet(CONFIG.SHEET_WORK);
  const idx = headerIndexMap(sheet);
  const orderCol = idx['Order no.'];
  if (!orderCol) { recordToReplyLog_(msg, draft); return; }

  const lastRow = sheet.getLastRow();
  let targetRow = -1;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, orderCol, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(msg.orderId)) { targetRow = i + 2; break; }
    }
  }
  if (targetRow === -1) targetRow = sheet.getLastRow() + 1;

  const setCell = (colName, value) => {
    const c = idx[colName];
    if (c) sheet.getRange(targetRow, c).setValue(value);
  };
  if (idx['Order no.']) sheet.getRange(targetRow, orderCol).setValue(msg.orderId);
  setCell('最終バイヤーメッセージ', msg.body);
  setCell('AI返信案', draft);
  // 送信した返信文 / 送信日時 / オファー判断 は送信フェーズ(F4以降)で更新
}

/** 返信ログ: Order no. 未紐付メッセージを追記 */
function recordToReplyLog_(msg, draft) {
  const sheet = getSheet(CONFIG.SHEET_REPLY_LOG);
  sheet.appendRow([
    msg.messageId,
    msg.receiveDate || new Date(),
    msg.sender || '',
    msg.subject || '',
    msg.body || '',
    draft,
    '',   // 送信した返信文（F4で更新）
    '',   // 送信日時
    ''    // オファー判断
  ]);
}


// ============================================================
// ===== MockData.gs =====
// ============================================================
/**
 * MockData.gs — デモ用ダミーメッセージ
 *
 * eBay / Claude / Discord の認証が揃う前でも F1〜F3 のフローを検証できる。
 * - ANTHROPIC_API_KEY があれば実際に Claude が返信案を生成
 * - 未設定なら「スキップ」表示（フロー自体は流れる）
 * - DISCORD_WEBHOOK_URL があれば実際に Discord 投稿、無ければ logs に出力
 *
 * メニュー「▶ デモ: モックメッセージで実行」から呼ばれる。
 */

function mockPollMessages() {
  const mock = [
    {
      messageId: 'MOCK-MSG-001',
      sender: 'buyer_john',
      subject: 'Question about shipping',
      body: 'Hi! I just bought the camera lens. How long does shipping to California usually take? Thanks!',
      receiveDate: new Date().toISOString(),
      itemId: '123456789',
      orderId: ''            // 取引前の質問 → 返信ログ タブへ
    },
    {
      messageId: 'MOCK-MSG-002',
      sender: 'buyer_anna',
      subject: 'Re: Order confirmation',
      body: 'Could you please send me the tracking number for my leather wallet order? It has been a few days.',
      receiveDate: new Date().toISOString(),
      itemId: '987654321',
      orderId: 'MOCK-ORDER-002'  // Order 紐付き → 在庫発送_作業 タブへ
    },
    {
      messageId: 'MOCK-MSG-003',
      sender: 'buyer_kenji',
      subject: '商品について',
      body: 'こんにちは。このレンズは日本への発送は可能ですか？送料も教えてください。',
      receiveDate: new Date().toISOString(),
      itemId: '123456789',
      orderId: ''
    }
  ];

  // 重複排除: 既に処理済のモックIDは除外（2回実行しても増えないことの確認用）
  const unseen = mock.filter(m => !isMessageSeen_(m.messageId));
  if (unseen.length === 0) {
    logInfo('mock: 新規メッセージなし（全て処理済）');
    return;
  }
  logInfo('mock: 処理開始', { count: unseen.length });
  processMessages_(unseen);
}

/** デモ後のリセット（_seen_messages を空にして再実行可能にする） */
function resetMockSeen() {
  const sheet = getSheet(CONFIG.SHEET_SEEN);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) sheet.deleteRows(2, lastRow - 1);
  logInfo('mock: _seen_messages をリセット');
}


// ============================================================
// ===== Menu.gs =====
// ============================================================
/**
 * Menu.gs — スプレッドシートのカスタムメニュー
 */

function onOpen() {
  try { setupSheets(); } catch (e) {}

  SpreadsheetApp.getUi()
    .createMenu('💬 eBay返信BOT')
    .addItem('① シート初期化', 'setupSheets')
    .addSeparator()
    .addItem('▶ デモ: モックメッセージで実行', 'mockPollMessages')
    .addSeparator()
    .addItem('🔁 メッセージ取得→AI返信案→通知（本番）', 'pollMessages')
    .addSeparator()
    .addItem('⏰ 5分トリガー有効化', 'installTriggers')
    .addItem('🛑 トリガー停止', 'uninstallTriggers')
    .addToUi();
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pollMessages')
    .timeBased()
    .everyMinutes(CONFIG.POLLING_INTERVAL_MINUTES)
    .create();
  Logger.log('Trigger installed: pollMessages @ 5min');
}

function uninstallTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('All triggers removed');
}


