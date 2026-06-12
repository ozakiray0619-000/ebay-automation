/**
 * Menu.gs — スプレッドシート上に「eBay自動化」カスタムメニューを追加
 *
 * onOpen() はスプレッドシート起動時に自動で呼ばれる simple trigger。
 * GASエディタを開かずに、スプレッドシートのメニューから各処理を実行できる。
 */

function onOpen() {
  // 1. シート3つを自動作成（simple trigger で実行可能、認証不要）
  try {
    setupSheets();
  } catch (e) {
    // 既に存在する場合などは無視
  }

  // 2. カスタムメニューを追加
  SpreadsheetApp.getUi()
    .createMenu('🤖 eBay自動化')
    .addItem('① シート再初期化', 'setupSheets')
    .addSeparator()
    .addItem('▶ モック注文を生成', 'mockPollOrders')
    .addItem('▶ モックオファーを生成', 'mockPollOffers')
    .addSeparator()
    .addItem('🔁 注文を取得（本番）', 'pollOrders')
    .addItem('🔁 オファーを取得（本番）', 'pollOffers')
    .addSeparator()
    .addItem('⏰ 5分トリガーを有効化', 'installTriggers')
    .addItem('🛑 トリガーを停止', 'uninstallTriggers')
    .addToUi();
}
