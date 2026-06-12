/**
 * F4_WebApp.gs — ワンクリック送信（リンク方式 / 全部GAS）
 *
 * 流れ:
 *   1. Discord通知のリンクを押す → doGet がレビュー画面(HTML)を返す
 *   2. 画面で返信案を確認・編集 → 「送信」ボタン
 *   3. google.script.run が f4SubmitSend を呼ぶ → eBay送信（既定MOCK）→ 返信ログ更新
 *
 * デプロイ（一度だけ）:
 *   「デプロイ > 新しいデプロイ > 種類=ウェブアプリ」
 *     - 次のユーザーとして実行: 自分
 *     - アクセスできるユーザー: 全員（匿名含む）
 *   公開された /exec の URL を Script Property "WEBAPP_URL" に保存する。
 *   任意: f4GenerateSecret() でリンク用トークン F4_LINK_SECRET を発行。
 *
 * 必要 Script Properties:
 *   WEBAPP_URL       : このウェブアプリの /exec URL（リンク生成に使用）
 *   F4_LINK_SECRET   : リンクの簡易トークン（任意。未設定なら検証スキップ）
 *   F4_MOCK_SEND     : "false" で実送信。既定（未設定/その他）は MOCK
 */

// ===== Web App エントリ =====

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || 'review';
  try {
    if (action === 'review') return renderReviewPage_(p.id, p.t);
    return htmlMessage_('不明な操作です。', false);
  } catch (err) {
    logError('doGet failed', { error: err.message, stack: err.stack });
    return htmlMessage_('エラー: ' + err.message, false);
  }
}

// ===== リンク生成 / トークン =====

/** Discord通知に載せるレビューURLを生成（WEBAPP_URL 未設定なら空文字） */
function f4Link_(messageId) {
  const base = getPropOptional('WEBAPP_URL');
  if (!base) return '';
  const secret = getPropOptional('F4_LINK_SECRET') || '';
  const q = 'action=review&id=' + encodeURIComponent(messageId) +
            (secret ? '&t=' + encodeURIComponent(secret) : '');
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + q;
}

/** リンクのトークン検証（F4_LINK_SECRET 未設定なら常に true） */
function f4CheckToken_(token) {
  const secret = getPropOptional('F4_LINK_SECRET');
  if (!secret) return true;
  return token === secret;
}

/** ランダムなリンク用トークンを生成・保存（メニューから実行） */
function f4GenerateSecret() {
  const secret = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('F4_LINK_SECRET', secret);
  Logger.log('F4_LINK_SECRET を生成・保存しました。');
  return secret;
}

/** 現在のF4関連設定をログ表示（メニューから実行） */
function showF4Setup() {
  Logger.log('WEBAPP_URL      = ' + (getPropOptional('WEBAPP_URL') || '(未設定)'));
  Logger.log('F4_LINK_SECRET  = ' + (getPropOptional('F4_LINK_SECRET') ? '(設定済み)' : '(未設定)'));
  Logger.log('F4_MOCK_SEND    = ' + (getPropOptional('F4_MOCK_SEND') || '(未設定→既定: MOCK)'));
}

// ===== レコード検索（返信ログ） =====

/** 返信ログから messageId 一致レコードを取得（無ければ null） */
function findF4Record_(messageId) {
  const sheet = getSheet(CONFIG.SHEET_REPLY_LOG);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return null;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const col = {};
  headers.forEach((h, i) => { col[h] = i + 1; });
  const idCol = col['メッセージID'];
  if (!idCol) return null;
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][idCol - 1]) === String(messageId)) {
      const get = (name) => col[name] ? data[i][col[name] - 1] : '';
      return {
        row: i + 2,
        col: col,
        messageId: messageId,
        sender:   get('バイヤーID'),
        subject:  get('件名'),
        body:     get('本文'),
        draft:    get('AI返信案'),
        itemId:   get('ItemID'),
        sentText: get('送信した返信文'),
        sentAt:   get('送信日時')
      };
    }
  }
  return null;
}

// ===== サーバー関数（HTMLから google.script.run で呼ばれる） =====

/**
 * 返信を送信。
 * 戻り値: { ok:boolean, mock?:boolean, error?:string }
 */
function f4SubmitSend(messageId, token, replyText) {
  try {
    if (!f4CheckToken_(token)) return { ok: false, error: 'リンクのトークンが一致しません。' };
    const rec = findF4Record_(messageId);
    if (!rec) return { ok: false, error: '対象メッセージが見つかりません（ID: ' + messageId + '）。' };
    if (rec.sentAt) return { ok: false, error: 'このメッセージは既に送信済みです。' };
    if (!replyText || !String(replyText).trim()) return { ok: false, error: '返信文が空です。' };

    // eBay 送信（既定 MOCK）。ItemID は返信ログから取得（実送信時に必須）。
    const result = ebaySendMemberMessage_({
      itemId: rec.itemId || '',
      recipientId: rec.sender || '',
      parentMessageId: messageId,
      body: replyText
    });

    // 返信ログ更新（送信した返信文 / 送信日時）= 二重送信防止フラグ
    const sheet = getSheet(CONFIG.SHEET_REPLY_LOG);
    if (rec.col['送信した返信文']) sheet.getRange(rec.row, rec.col['送信した返信文']).setValue(replyText);
    if (rec.col['送信日時'])     sheet.getRange(rec.row, rec.col['送信日時']).setValue(new Date());

    logInfo('F4 送信完了', { messageId: messageId, mock: !!result.mock });
    return { ok: true, mock: !!result.mock };
  } catch (err) {
    logError('f4SubmitSend failed', { messageId: messageId, error: err.message });
    return { ok: false, error: err.message };
  }
}

// ===== HTML レンダリング =====

function renderReviewPage_(messageId, token) {
  if (!f4CheckToken_(token)) return htmlMessage_('リンクが無効です（トークン不一致）。', false);
  if (!messageId)            return htmlMessage_('メッセージIDが指定されていません。', false);
  const rec = findF4Record_(messageId);
  if (!rec)                  return htmlMessage_('対象メッセージが見つかりません（ID: ' + messageId + '）。', false);

  const esc = htmlEscape_;
  const already = !!rec.sentAt;
  const sentBanner = already
    ? `<div class="banner sent">✅ このメッセージは送信済みです（${esc(rec.sentAt)}）</div>`
    : '';
  const mockNote = (isMockSend_())
    ? `<div class="note">現在は <b>モックモード</b>です（eBayへ実送信はせず、動作確認のみ）。本番接続後に解除します。</div>`
    : '';

  const html = `<!DOCTYPE html><html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>eBay 返信レビュー</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px;color:#111827;}
  .card{max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06);}
  h2{margin:0 0 8px;font-size:20px;}
  .meta{color:#6b7280;font-size:13px;margin-bottom:16px;}
  .label{font-size:13px;font-weight:600;color:#374151;margin:16px 0 6px;}
  .msg{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;font-size:14px;line-height:1.6;white-space:normal;}
  textarea{width:100%;box-sizing:border-box;min-height:150px;border:1px solid #d1d5db;border-radius:10px;padding:12px;font-size:14px;line-height:1.6;resize:vertical;font-family:inherit;}
  .actions{margin-top:16px;}
  button.primary{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer;}
  button.primary:disabled{background:#9ca3af;cursor:not-allowed;}
  .status{margin-top:14px;font-size:14px;min-height:20px;}
  .status.ok{color:#16a34a;font-weight:600;}
  .status.err{color:#b91c1c;font-weight:600;}
  .banner{padding:10px 12px;border-radius:10px;font-size:14px;margin-bottom:12px;}
  .banner.sent{background:#dcfce7;color:#166534;}
  .note{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px;}
</style></head><body>
<div class="card">
  <h2>eBay 返信レビュー</h2>
  ${sentBanner}${mockNote}
  <div class="meta"><b>From:</b> ${esc(rec.sender) || '(unknown)'}　／　<b>件名:</b> ${esc(rec.subject) || '(なし)'}${rec.itemId ? '　／　<b>Item:</b> ' + esc(rec.itemId) : ''}</div>
  <div class="label">バイヤーのメッセージ</div>
  <div class="msg">${esc(rec.body).replace(/\n/g, '<br>')}</div>
  <div class="label">返信文（確認・編集できます）</div>
  <textarea id="reply" ${already ? 'disabled' : ''}></textarea>
  <div class="actions">
    <button id="send" class="primary" ${already ? 'disabled' : ''}>この内容で送信</button>
  </div>
  <div id="status" class="status"></div>
</div>
<script>
  var MSG_ID = ${JSON.stringify(messageId)};
  var TOKEN  = ${JSON.stringify(token || '')};
  document.getElementById('reply').value = ${JSON.stringify(rec.draft || '')};
  function setStatus(t, cls){ var s=document.getElementById('status'); s.textContent=t; s.className='status '+(cls||''); }
  var btn = document.getElementById('send');
  btn && btn.addEventListener('click', function(){
    btn.disabled = true; setStatus('送信中…', '');
    var text = document.getElementById('reply').value;
    google.script.run
      .withSuccessHandler(function(r){
        if (r && r.ok){
          setStatus('✅ 送信しました' + (r.mock ? '（モック）' : '') + '。', 'ok');
          document.getElementById('reply').disabled = true;
        } else {
          setStatus('⚠ ' + ((r && r.error) || '送信に失敗しました'), 'err');
          btn.disabled = false;
        }
      })
      .withFailureHandler(function(err){ setStatus('⚠ エラー: ' + err.message, 'err'); btn.disabled = false; })
      .f4SubmitSend(MSG_ID, TOKEN, text);
  });
</script>
</body></html>`;
  return HtmlService.createHtmlOutput(html)
    .setTitle('eBay 返信レビュー')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** シンプルなメッセージページ */
function htmlMessage_(text, ok) {
  const color = ok ? '#16a34a' : '#b91c1c';
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f3f4f6;padding:24px;">
<div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
<p style="color:${color};font-size:16px;margin:0;">${htmlEscape_(text)}</p></div></body></html>`;
  return HtmlService.createHtmlOutput(html);
}

/** HTML エスケープ */
function htmlEscape_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
