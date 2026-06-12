/**
 * mock-ebay-server.js — ローカル「偽eBayサーバー」
 *
 * eBay APIキーが取れない/Sandbox障害でも、通知パイプラインを丸ごと
 * 検証するためのダミーサーバー。本物のeBayと「同じ形のレスポンス」を返す:
 *
 *   POST /identity/v1/oauth2/token          → OAuthアクセストークン(JSON)
 *   GET  /sell/fulfillment/v1/order         → 注文一覧 (Fulfillment REST JSON / F-01相当)
 *   POST /ws/api.dll  (GetBestOffers)       → Best Offer (Trading API XML / F-03相当)
 *
 * Node標準モジュールのみ。npm install 不要。
 *
 *   node mock-ebay-server.js          # ポート 8787 で起動
 *   PORT=9000 node mock-ebay-server.js
 *
 * 返すダミー件数は scenario.json で調整可能（無ければ既定データ）。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;

// ---- シナリオ(ダミーデータ)読み込み -------------------------------------
function loadScenario() {
  const p = path.join(__dirname, 'scenario.json');
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.error('[mock] scenario.json 読込失敗、既定データを使用:', e.message); }
  }
  return DEFAULT_SCENARIO;
}

const DEFAULT_SCENARIO = {
  orders: [
    {
      orderId: 'MOCK-ORD-1001',
      buyerUsername: 'tokyo_collector',
      title: 'Vintage Camera Lens 50mm f/1.4',
      total: '149.99', currency: 'USD',
      fullName: 'John Smith', email: 'john@example.com', country: 'US',
      status: 'NOT_STARTED'
    },
    {
      orderId: 'MOCK-ORD-1002',
      buyerUsername: 'berlin_maker',
      title: 'Handmade Leather Wallet - Brown',
      total: '38.00', currency: 'USD',
      fullName: 'Anna Müller', email: 'anna@example.de', country: 'DE',
      status: 'IN_PROGRESS'
    }
  ],
  offers: [
    {
      offerId: 'MOCK-OFF-2001', itemId: '110047650001',
      title: 'Vintage Camera Lens 50mm f/1.4',
      buyer: 'osaka_buyer', price: '120.00', status: 'Active'
    }
  ]
};

// ---- レスポンス生成 -------------------------------------------------------

/** Fulfillment REST: GET /sell/fulfillment/v1/order と同じ形 */
function buildOrdersJson(scenario) {
  const now = new Date().toISOString();
  return {
    total: scenario.orders.length,
    orders: scenario.orders.map(o => ({
      orderId: o.orderId,
      buyer: { username: o.buyerUsername },
      creationDate: o.creationDate || now,
      orderFulfillmentStatus: o.status || 'NOT_STARTED',
      pricingSummary: { total: { value: o.total, currency: o.currency || 'USD' } },
      lineItems: [{ title: o.title, lineItemId: 'LI-' + o.orderId }],
      fulfillmentStartInstructions: [{
        shippingStep: {
          shipTo: {
            fullName: o.fullName || '',
            contactAddress: { email: o.email || '', countryCode: o.country || '' }
          }
        }
      }]
    }))
  };
}

/** Trading API: GetBestOffersResponse と同じネスト構造のXML */
function buildBestOffersXml(scenario) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const items = scenario.offers.map(o => `
    <ItemBestOffers>
      <Item>
        <ItemID>${esc(o.itemId)}</ItemID>
        <Title>${esc(o.title)}</Title>
      </Item>
      <BestOfferArray>
        <BestOffer>
          <BestOfferID>${esc(o.offerId)}</BestOfferID>
          <Buyer><UserID>${esc(o.buyer)}</UserID></Buyer>
          <Price currencyID="USD">${esc(o.price)}</Price>
          <Status>${esc(o.status)}</Status>
        </BestOffer>
      </BestOfferArray>
    </ItemBestOffers>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<GetBestOffersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <Version>1193</Version>
  <ItemBestOffersArray>${items}
  </ItemBestOffersArray>
</GetBestOffersResponse>`;
}

// ---- ルーティング ---------------------------------------------------------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const scenario = loadScenario();

  // OAuth トークン発行
  if (req.method === 'POST' && url.pathname === '/identity/v1/oauth2/token') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      access_token: 'MOCK-ACCESS-TOKEN-' + Date.now(),
      token_type: 'Application Access Token',
      expires_in: 7200
    }));
    return;
  }

  // 注文一覧 (REST JSON)
  if (req.method === 'GET' && url.pathname === '/sell/fulfillment/v1/order') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(buildOrdersJson(scenario)));
    console.log(`[mock] GET orders → ${scenario.orders.length}件`);
    return;
  }

  // Trading API (XML) — Call名はヘッダで判定
  if (req.method === 'POST' && url.pathname === '/ws/api.dll') {
    const call = req.headers['x-ebay-api-call-name'] || '';
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    if (call === 'GetBestOffers') {
      res.end(buildBestOffersXml(scenario));
      console.log(`[mock] POST GetBestOffers → ${scenario.offers.length}件`);
    } else {
      res.end(`<?xml version="1.0"?><Response><Ack>Success</Ack></Response>`);
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found: ' + url.pathname);
});

server.listen(PORT, () => {
  console.log(`[mock] 偽eBayサーバー起動: http://localhost:${PORT}`);
  console.log(`[mock]   GET  /sell/fulfillment/v1/order   (注文 JSON)`);
  console.log(`[mock]   POST /ws/api.dll  GetBestOffers    (オファー XML)`);
  console.log(`[mock]   POST /identity/v1/oauth2/token     (OAuth)`);
});
