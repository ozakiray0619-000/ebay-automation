/**
 * MockData.gs — Phase 1（モック開発）用のダミーデータ
 *
 * eBay API が使えない期間に F-01 / F-03 のシート書込ロジックを検証する。
 * 動作確認後はこのファイルを除外、または mockMode フラグで切替。
 */

function mockPollOrders() {
  const mock = [
    {
      orderId: 'MOCK-ORDER-001',
      buyer: { username: 'mockbuyer1' },
      creationDate: new Date().toISOString(),
      orderFulfillmentStatus: 'NOT_STARTED',
      pricingSummary: { total: { value: '49.99', currency: 'USD' } },
      lineItems: [{ title: 'Vintage Camera Lens 50mm f/1.4' }],
      fulfillmentStartInstructions: [{
        shippingStep: {
          shipTo: {
            fullName: 'John Smith',
            contactAddress: { email: 'john@example.com', countryCode: 'US' }
          }
        }
      }]
    },
    {
      orderId: 'MOCK-ORDER-002',
      buyer: { username: 'mockbuyer2' },
      creationDate: new Date().toISOString(),
      orderFulfillmentStatus: 'IN_PROGRESS',
      pricingSummary: { total: { value: '129.00', currency: 'USD' } },
      lineItems: [{ title: 'Handmade Leather Wallet - Brown' }],
      fulfillmentStartInstructions: [{
        shippingStep: {
          shipTo: {
            fullName: 'Anna Müller',
            contactAddress: { email: 'anna@example.de', countryCode: 'DE' }
          }
        }
      }]
    }
  ];
  const newOnes = filterUnseenOrders(mock);
  if (newOnes.length === 0) { logInfo('mock: no new orders'); return; }
  appendOrdersToSheet(newOnes);
  newOnes.forEach(notifyOrderToDiscord);
  logInfo('mock orders appended', { count: newOnes.length });
}

function mockPollOffers() {
  const mock = [
    {
      offerId: 'MOCK-OFFER-001',
      itemId:  '123456789',
      title:   'Vintage Camera Lens 50mm f/1.4',
      buyer:   'offerbuyer1',
      price:   '40.00',
      status:  'Active'
    }
  ];
  const newOnes = filterUnseenOffers(mock);
  if (newOnes.length > 0) appendOffersToSheet(newOnes);
  getUnnotifiedOffers().forEach(notifyOfferToDiscord);
}
