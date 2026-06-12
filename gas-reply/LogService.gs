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
