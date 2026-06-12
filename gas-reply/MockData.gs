/**
 * MockData.gs — デモ用ダミーメッセージ
 *
 * eBay / Claude / Discord の認証が揃う前でも F1〜F3 のフローを検証できる。
 * - ANTHROPIC_API_KEY があれば実際に Claude が返信案を生成
 * - 未設定なら「スキップ」表示（フロー自体は流れる）
 * - DISCORD_WEBHOOK_URL があれば実際に Discord 投稿、無ければ logs に出力
 *
 * メニュー「▶ デモ: モックメッセージで実行」から呼ばれる。
 */

function mockPollMessages() {
  const mock = [
    {
      messageId: 'MOCK-MSG-001',
      sender: 'buyer_john',
      subject: 'Question about shipping',
      body: 'Hi! I just bought the camera lens. How long does shipping to California usually take? Thanks!',
      receiveDate: new Date().toISOString(),
      itemId: '123456789',
      orderId: ''            // 取引前の質問 → 返信ログ タブへ
    },
    {
      messageId: 'MOCK-MSG-002',
      sender: 'buyer_anna',
      subject: 'Re: Order confirmation',
      body: 'Could you please send me the tracking number for my leather wallet order? It has been a few days.',
      receiveDate: new Date().toISOString(),
      itemId: '987654321',
      orderId: 'MOCK-ORDER-002'  // Order 紐付き → 在庫発送_作業 タブへ
    },
    {
      messageId: 'MOCK-MSG-003',
      sender: 'buyer_kenji',
      subject: '商品について',
      body: 'こんにちは。このレンズは日本への発送は可能ですか？送料も教えてください。',
      receiveDate: new Date().toISOString(),
      itemId: '123456789',
      orderId: ''
    }
  ];

  // 重複排除: 既に処理済のモックIDは除外（2回実行しても増えないことの確認用）
  const unseen = mock.filter(m => !isMessageSeen_(m.messageId));
  if (unseen.length === 0) {
    logInfo('mock: 新規メッセージなし（全て処理済）');
    return;
  }
  logInfo('mock: 処理開始', { count: unseen.length });
  processMessages_(unseen);
}

/** デモ後のリセット（_seen_messages を空にして再実行可能にする） */
function resetMockSeen() {
  const sheet = getSheet(CONFIG.SHEET_SEEN);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) sheet.deleteRows(2, lastRow - 1);
  logInfo('mock: _seen_messages をリセット');
}
