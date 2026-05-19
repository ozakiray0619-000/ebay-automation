/**
 * F-01 購入履歴・連絡先取得
 *
 * eBay REST Fulfillment API から注文を取得し、orders シートに追記する。
 * - 注文IDで重複チェック（既存IDはスキップ）
 * - 商品名は F-02 で翻訳
 * - 5分間隔の時間トリガーから呼ばれる前提
 */

function pollOrders() {
  try {
    const orders = fetchRecentOrders();
    logInfo('fetchRecentOrders ok', { count: orders.length });
    const newOrders = filterUnseenOrders(orders);
    if (newOrders.length === 0) {
      logInfo('No new orders');
      return;
    }
    appendOrdersToSheet(newOrders);
    logInfo('Orders appended', { count: newOrders.length });
  } catch (err) {
    logError('pollOrders failed', { error: err.message, stack: err.stack });
  }
}

/** eBay Fulfillment API から注文取得 */
function fetchRecentOrders() {
  const endpoints = getEndpoints();
  const since = new Date(Date.now() - CONFIG.INITIAL_FETCH_DAYS_BACK * 24 * 60 * 60 * 1000);
  const filter = `creationdate:[${since.toISOString()}..]`;
  const url = `${endpoints.REST}/sell/fulfillment/v1/order?filter=${encodeURIComponent(filter)}&limit=200`;

  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`fetchRecentOrders ${res.getResponseCode()}: ${res.getContentText()}`);
  }
  const data = JSON.parse(res.getContentText());
  return data.orders || [];
}

/** 既存注文IDを除外 */
function filterUnseenOrders(orders) {
  const sheet = getSheet(CONFIG.SHEET_ORDERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return orders;
  const existingIds = new Set(
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]))
  );
  return orders.filter(o => !existingIds.has(String(o.orderId)));
}

/** orders シートに追記（12列） */
function appendOrdersToSheet(orders) {
  const sheet = getSheet(CONFIG.SHEET_ORDERS);
  const now = new Date();
  const rows = orders.map(o => {
    const item = (o.lineItems && o.lineItems[0]) || {};
    const buyer = o.buyer || {};
    const total = o.pricingSummary && o.pricingSummary.total || {};
    const shipTo = o.fulfillmentStartInstructions && o.fulfillmentStartInstructions[0]
      && o.fulfillmentStartInstructions[0].shippingStep
      && o.fulfillmentStartInstructions[0].shippingStep.shipTo || {};
    const titleOrig = item.title || '';
    return [
      o.orderId,                                                  // 注文ID
      (shipTo.fullName) || (buyer.username) || '',                // 購入者名
      buyer.username || '',                                        // 購入者ID
      (shipTo.contactAddress && shipTo.contactAddress.email)
        || (shipTo.primaryPhone && shipTo.primaryPhone.phoneNumber) || '', // 連絡先
      titleOrig,                                                   // 商品名(原文)
      translateToJa(titleOrig),                                    // 商品名(日本語)
      total.value || '',                                           // 金額
      total.currency || '',                                        // 通貨
      o.creationDate || '',                                        // 注文日時
      o.orderFulfillmentStatus || '',                              // ステータス
      (shipTo.contactAddress && shipTo.contactAddress.countryCode) || '', // 配送先(国)
      now                                                          // 取得日時
    ];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 12).setValues(rows);
}
