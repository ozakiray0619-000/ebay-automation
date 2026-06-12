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
  if (!sheet) throw new Error('Sheet "' + name + '" not found. Run setupSheets() first.');
  return sheet;
}

/** 初回セットアップ: 必要シートをヘッダ付きで作成（冪等） */
function setupSheets() {
  const ss = openSpreadsheet();

  ensureSheetWithHeaders_(ss, CONFIG.SHEET_REPLY_LOG, [
    'メッセージID', '受信日時', 'バイヤーID', '件名', '本文',
    'AI返信案', '送信した返信文', '送信日時', 'オファー判断', 'ItemID'
  ]);
  // 既存の返信ログにも ItemID 列を追加（実送信 AddMemberMessageRTQ で必須）
  ensureColumns_(ss.getSheetByName(CONFIG.SHEET_REPLY_LOG), ['ItemID']);

  ensureSheetWithHeaders_(ss, CONFIG.SHEET_LOGS, [
    'timestamp', 'level', 'message', 'meta'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEET_SEEN, [
    'メッセージID', '処理日時'
  ]);

  if (!ss.getSheetByName(CONFIG.SHEET_WORK)) {
    ensureSheetWithHeaders_(ss, CONFIG.SHEET_WORK, [
      'Order no.', '最終バイヤーメッセージ', 'AI返信案',
      '送信した返信文', '送信日時', 'オファー判断'
    ]);
  } else {
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
