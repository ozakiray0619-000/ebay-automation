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

/** 返信ログ: Order no. 未紐付メッセージを追記（ヘッダ名で書くので列順に依存しない） */
function recordToReplyLog_(msg, draft) {
  const sheet = getSheet(CONFIG.SHEET_REPLY_LOG);
  ensureColumns_(sheet, ['ItemID']); // 旧シートにも ItemID 列を保証
  const idx = headerIndexMap(sheet);
  const width = Math.max(sheet.getLastColumn(), 1);
  const row = new Array(width).fill('');
  const put = (name, val) => { if (idx[name]) row[idx[name] - 1] = val; };
  put('メッセージID', msg.messageId);
  put('受信日時', msg.receiveDate || new Date());
  put('バイヤーID', msg.sender || '');
  put('件名', msg.subject || '');
  put('本文', msg.body || '');
  put('AI返信案', draft);
  put('ItemID', msg.itemId || '');
  // 送信した返信文 / 送信日時 / オファー判断 は送信フェーズ(F4)で更新
  sheet.appendRow(row);
}
