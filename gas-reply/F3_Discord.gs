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

  // F4: ワンクリック送信レビューリンク（返信ログに載るメッセージ＝orderId未紐付のみ）。
  // WEBAPP_URL 未設定や work シート行は従来の注記にフォールバック。
  const link = (!message.orderId && typeof f4Link_ === 'function') ? f4Link_(message.messageId) : '';
  const footer = link
    ? `▶ **[この返信を確認・送信する](${link})**`
    : '_※ ワンクリック送信リンクは WEBAPP_URL 設定後に表示されます（現在は通知のみ）。_';

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
    footer
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
