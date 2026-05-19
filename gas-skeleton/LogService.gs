/**
 * LogService.gs — logs シートへの構造化ログ書き込み + 1000行ローテーション
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
    // ログ書き込みで失敗しても本処理を止めない
    Logger.log(`[writeLog_ failed] ${err.message}`);
  }
}

/** 1000行を超えたら古い行から削除 */
function rotateLogsIfNeeded_(sheet) {
  const lastRow = sheet.getLastRow();
  const dataRows = lastRow - 1; // ヘッダ除く
  if (dataRows > CONFIG.LOGS_MAX_ROWS) {
    const toDelete = dataRows - CONFIG.LOGS_MAX_ROWS;
    sheet.deleteRows(2, toDelete);
  }
}
