/**
 * Triggers.gs — 5分間隔の時間トリガー設定
 *
 * GASエディタから installTriggers() を1回実行。
 * 既存トリガーは全削除した上で再設定する。
 */

function installTriggers() {
  // 既存の全トリガー削除
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // pollOrders を 5分ごと
  ScriptApp.newTrigger('pollOrders')
    .timeBased()
    .everyMinutes(CONFIG.POLLING_INTERVAL_MINUTES)
    .create();

  // pollOffers を 5分ごと
  ScriptApp.newTrigger('pollOffers')
    .timeBased()
    .everyMinutes(CONFIG.POLLING_INTERVAL_MINUTES)
    .create();

  Logger.log('Triggers installed: pollOrders / pollOffers @ 5min');
}

function uninstallTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('All triggers removed');
}
