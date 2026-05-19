/**
 * SheetService.gs — シートアクセスのユーティリティ
 */

function openSpreadsheet() {
  // GASプロジェクトが紐付いているスプレッドシートを優先使用（プロパティ不要）
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  // フォールバック: SPREADSHEET_ID プロパティが明示されていれば使う
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('スプレッドシートが見つかりません。GASプロジェクトをスプレッドシートに紐付けてください。');
}

function getSheet(name) {
  const ss = openSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found. Run setupSheets() first.`);
  return sheet;
}

/**
 * 初回セットアップ: 3シートをヘッダ付きで作成
 * 手動で1回だけ実行（GASエディタの関数選択 → setupSheets → 実行）
 */
function setupSheets() {
  const ss = openSpreadsheet();

  ensureSheetWithHeaders(ss, CONFIG.SHEET_ORDERS, [
    '注文ID', '購入者名', '購入者ID', '連絡先',
    '商品名(原文)', '商品名(日本語)',
    '金額', '通貨', '注文日時', 'ステータス', '配送先(国)', '取得日時'
  ]);

  ensureSheetWithHeaders(ss, CONFIG.SHEET_OFFERS, [
    'オファーID', '商品ID', '商品名(原文)', '商品名(日本語)',
    '購入者名', 'オファー金額', 'ステータス', '取得日時', '通知済'
  ]);

  ensureSheetWithHeaders(ss, CONFIG.SHEET_LOGS, [
    'timestamp', 'level', 'message', 'meta'
  ]);

  Logger.log('setupSheets: complete');
}

function ensureSheetWithHeaders(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  // 既存ヘッダがあるか確認
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some(c => c !== '');
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}
