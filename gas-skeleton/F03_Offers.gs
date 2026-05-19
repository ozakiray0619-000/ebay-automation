/**
 * F-03 オファー通知
 *
 * Trading API の GetBestOffers を呼び、新規 Best Offer を offers シートに記録、
 * 未通知のものを Discord Webhook へ送信する。
 *
 * 注意: Trading API は OAuth ではなく Auth'n'Auth トークンを使用。
 *       EBAY_AUTH_TOKEN スクリプトプロパティに保存する。
 */

function pollOffers() {
  try {
    const offers = fetchActiveBestOffers();
    logInfo('fetchActiveBestOffers ok', { count: offers.length });
    const newOffers = filterUnseenOffers(offers);
    if (newOffers.length > 0) {
      appendOffersToSheet(newOffers);
    }
    const unsent = getUnnotifiedOffers();
    unsent.forEach(notifyOfferToDiscord);
  } catch (err) {
    logError('pollOffers failed', { error: err.message, stack: err.stack });
  }
}

/** Trading API GetBestOffers 呼び出し */
function fetchActiveBestOffers() {
  const endpoints = getEndpoints();
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetBestOffersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${getProp('EBAY_AUTH_TOKEN')}</eBayAuthToken></RequesterCredentials>
  <DetailLevel>ReturnAll</DetailLevel>
  <BestOfferStatus>Active</BestOfferStatus>
</GetBestOffersRequest>`;

  const res = UrlFetchApp.fetch(endpoints.TRADING, {
    method: 'post',
    contentType: 'text/xml',
    headers: {
      'X-EBAY-API-COMPATIBILITY-LEVEL': CONFIG.TRADING_API_COMPATIBILITY_LEVEL,
      'X-EBAY-API-DEV-NAME':  getProp('EBAY_DEV_ID'),
      'X-EBAY-API-APP-NAME':  getProp('EBAY_APP_ID'),
      'X-EBAY-API-CERT-NAME': getProp('EBAY_CERT_ID'),
      'X-EBAY-API-CALL-NAME': 'GetBestOffers',
      'X-EBAY-API-SITEID':    CONFIG.TRADING_API_SITE_ID
    },
    payload: xml,
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`GetBestOffers ${res.getResponseCode()}: ${res.getContentText().slice(0, 500)}`);
  }
  return parseBestOffersXml(res.getContentText());
}

/** XML を JS オブジェクトに変換（XmlServiceで最小限のフィールドだけ抽出） */
function parseBestOffersXml(xmlText) {
  const doc = XmlService.parse(xmlText);
  const root = doc.getRootElement();
  const ns = root.getNamespace();
  const itemNodes = root.getChildren('BestOfferArray', ns).flatMap(n => n.getChildren('BestOffer', ns));
  return itemNodes.map(n => {
    const get = (name) => {
      const c = n.getChild(name, ns);
      return c ? c.getText() : '';
    };
    const itemNode = n.getChild('Item', ns);
    const buyerNode = n.getChild('Buyer', ns);
    const priceNode = n.getChild('Price', ns);
    return {
      offerId: get('BestOfferID'),
      itemId:  itemNode ? (itemNode.getChild('ItemID', ns) || {}).getText && itemNode.getChild('ItemID', ns).getText() : '',
      title:   itemNode ? (itemNode.getChild('Title', ns) || {}).getText && itemNode.getChild('Title', ns).getText() : '',
      buyer:   buyerNode ? (buyerNode.getChild('UserID', ns) || {}).getText && buyerNode.getChild('UserID', ns).getText() : '',
      price:   priceNode ? priceNode.getText() : '',
      status:  get('Status')
    };
  });
}

function filterUnseenOffers(offers) {
  const sheet = getSheet(CONFIG.SHEET_OFFERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return offers;
  const existingIds = new Set(
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]))
  );
  return offers.filter(o => !existingIds.has(String(o.offerId)));
}

/** offers シートに追記（9列） */
function appendOffersToSheet(offers) {
  const sheet = getSheet(CONFIG.SHEET_OFFERS);
  const now = new Date();
  const rows = offers.map(o => [
    o.offerId,                    // オファーID
    o.itemId,                     // 商品ID
    o.title,                      // 商品名(原文)
    translateToJa(o.title),       // 商品名(日本語)
    o.buyer,                      // 購入者名
    o.price,                      // オファー金額
    o.status,                     // ステータス
    now,                          // 取得日時
    false                         // 通知済
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
}

/** 通知済フラグ false の行を取得 */
function getUnnotifiedOffers() {
  const sheet = getSheet(CONFIG.SHEET_OFFERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  return data
    .map((row, i) => ({ rowIndex: i + 2, row }))
    .filter(x => !x.row[8]); // 9列目 = 通知済
}

/** Discord 通知 + シートのフラグ更新 */
function notifyOfferToDiscord(item) {
  const [offerId, itemId, titleOrig, titleJa, buyer, price, status] = item.row;
  const content = `🎯 **新規 Best Offer**\n` +
    `**商品**: ${titleJa} _(原文: ${titleOrig})_\n` +
    `**購入希望者**: ${buyer}\n` +
    `**金額**: ${price}\n` +
    `**ステータス**: ${status}\n` +
    `**Item ID**: ${itemId} / **Offer ID**: ${offerId}`;
  postToDiscord(content);
  const sheet = getSheet(CONFIG.SHEET_OFFERS);
  sheet.getRange(item.rowIndex, 9).setValue(true);
}
