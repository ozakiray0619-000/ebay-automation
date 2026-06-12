/**
 * SheetService.gs — シートアクセスのユーティリティ
 */

function openSpreadsheet() {
  // 1. GASプロジェクトが紐付いているスプレッドシートを優先使用（プロパティ不要）
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  const props = PropertiesService.getScriptProperties();

  // 2. SPREADSHEET_ID プロパティが明示されていれば使う（既存ファイルを開く）
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // 保存済IDが無効（削除済など）の場合は作り直しへフォールバック
      logInfo('SPREADSHEET_ID が無効。新規作成にフォールバック', { id: id, error: e.message });
    }
  }

  // 3. どこにも無ければ新規スプレッドシートを自動生成し、IDを保存して以降再利用
  const ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_TITLE || 'eBay自動化データ');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  logInfo('スプレッドシートを自動生成しました', { id: ss.getId(), url: ss.getUrl() });
  return ss;
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

/**
 * bootstrap — PowerShell (`clasp run bootstrap`) から1コマンドで初期化するエントリ。
 * スプレッドシートが無ければ自動生成し、3シートを作成して URL を返す。
 * 戻り値の URL は clasp run の実行結果として PowerShell 側に表示される。
 */
function bootstrap() {
  const ss = openSpreadsheet();   // 無ければ自動生成
  setupSheets();                  // orders / offers / logs を用意
  const url = ss.getUrl();
  Logger.log('bootstrap complete: ' + url);
  return url;
}

/** 現在使用中スプレッドシートの URL を返す（PowerShellから所在確認用） */
function getSpreadsheetUrl() {
  return openSpreadsheet().getUrl();
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
