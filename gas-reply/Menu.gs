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
    .addItem('🔐 F4: リンク用シークレット生成', 'f4GenerateSecret')
    .addItem('🌐 F4: 現在の設定を表示', 'showF4Setup')
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
