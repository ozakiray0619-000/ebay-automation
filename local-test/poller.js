/**
 * poller.js — 通知パイプライン(ローカル版)
 *
 * 偽eBayサーバー(mock-ebay-server.js)から注文/オファーを取得し、
 * GAS本体(F01_Orders.gs / F03_Offers.gs)と同じロジックで
 *   取得 → 重複除去 → 翻訳 → Discordメッセージ整形 → 送信
 * までを再現する。eBayの実キーは一切不要。
 *
 * Discordへの送信だけは「本物」なので、DISCORD_WEBHOOK_URL を設定すれば
 * 実際にスマホ/PCに通知が飛び、「通知が来るか」をE2Eで検証できる。
 * 未設定ならドライラン(コンソール表示のみ)。
 *
 *   node poller.js                 # 1回だけ実行
 *   node poller.js --loop 30       # 30秒ごとに繰り返し(Ctrl+Cで停止)
 *
 * Webhookの渡し方(どちらでも可):
 *   - 環境変数 DISCORD_WEBHOOK_URL
 *   - local-test/config.json の "DISCORD_WEBHOOK_URL"
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = process.env.EBAY_MOCK_BASE || 'http://localhost:8787';
const STATE_FILE = path.join(__dirname, '.state.json');

// ---- 設定読み込み ---------------------------------------------------------
function loadConfig() {
  const cfg = {};
  const p = path.join(__dirname, 'config.json');
  if (fs.existsSync(p)) {
    try { Object.assign(cfg, JSON.parse(fs.readFileSync(p, 'utf8'))); } catch (e) {}
  }
  // 環境変数が最優先
  if (process.env.DISCORD_WEBHOOK_URL) cfg.DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
  return cfg;
}

// ---- 状態(重複防止) ------------------------------------------------------
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
  }
  return { seenOrders: [], seenOffers: [] };
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

// ---- 簡易翻訳(ローカルスタブ) -------------------------------------------
// GAS本体は LanguageApp(Google翻訳)を使うが、ローカルでは使えないため
// デモ用の簡易辞書で代用。実機(GAS)では本物の翻訳が入る。
const DICT = {
  'Vintage Camera Lens 50mm f/1.4': 'ヴィンテージ カメラレンズ 50mm f/1.4',
  'Handmade Leather Wallet - Brown': 'ハンドメイド レザー財布 - ブラウン'
};
function translateToJa(text) { return DICT[text] || text; }

// ---- HTTP取得ヘルパ -------------------------------------------------------
function fetch(opts, body) {
  return new Promise((resolve, reject) => {
    const lib = opts.protocol === 'https:' ? https : http;
    const req = lib.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
function urlToOpts(u, method, headers) {
  const url = new URL(u);
  return {
    protocol: url.protocol, hostname: url.hostname,
    port: url.port || undefined,            // 空文字だと既定ポートにならないため undefined に
    path: url.pathname + url.search, method, headers: headers || {}
  };
}

// ---- F-01: 注文取得 -------------------------------------------------------
async function fetchOrders() {
  const r = await fetch(urlToOpts(`${BASE}/sell/fulfillment/v1/order?limit=200`, 'GET',
    { Authorization: 'Bearer MOCK', 'Content-Type': 'application/json' }));
  if (r.status !== 200) throw new Error(`fetchOrders ${r.status}: ${r.body}`);
  return (JSON.parse(r.body).orders) || [];
}

// ---- F-03: オファー取得 (Trading XML を最小パース) -----------------------
async function fetchOffers() {
  const xmlReq = `<?xml version="1.0"?><GetBestOffersRequest/>`;
  const r = await fetch(urlToOpts(`${BASE}/ws/api.dll`, 'POST',
    { 'Content-Type': 'text/xml', 'X-EBAY-API-CALL-NAME': 'GetBestOffers' }), xmlReq);
  if (r.status !== 200) throw new Error(`fetchOffers ${r.status}: ${r.body}`);
  return parseBestOffersXml(r.body);
}

/** GAS の parseBestOffersXml と同じ階層を踏むミニパーサ */
function parseBestOffersXml(xml) {
  const tag = (s, name) => { const m = s.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? m[1].trim() : ''; };
  const out = [];
  const blocks = xml.match(/<ItemBestOffers>[\s\S]*?<\/ItemBestOffers>/g) || [];
  for (const b of blocks) {
    const itemId = tag(b, 'ItemID');
    const title = tag(b, 'Title');
    const offers = b.match(/<BestOffer>[\s\S]*?<\/BestOffer>/g) || [];
    for (const bo of offers) {
      out.push({
        offerId: tag(bo, 'BestOfferID'),
        itemId, title,
        buyer: tag(bo, 'UserID'),
        price: tag(bo, 'Price'),
        status: tag(bo, 'Status')
      });
    }
  }
  return out;
}

// ---- Discord 送信 ---------------------------------------------------------
async function postToDiscord(content, webhook) {
  if (!webhook) {
    console.log('\n──── [DRY-RUN] Discord通知(送信せずプレビュー) ────');
    console.log(content);
    console.log('────────────────────────────────────────────────\n');
    return;
  }
  const payload = JSON.stringify({ content });
  const r = await fetch(urlToOpts(webhook, 'POST',
    { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }), payload);
  if (r.status !== 204 && r.status !== 200) throw new Error(`Discord ${r.status}: ${r.body}`);
  console.log('  ✓ Discordへ送信しました');
}

// ---- メッセージ整形 (GAS と同じ文面) -------------------------------------
function formatOrder(o) {
  const item = (o.lineItems && o.lineItems[0]) || {};
  const buyer = o.buyer || {};
  const total = (o.pricingSummary && o.pricingSummary.total) || {};
  const shipTo = (o.fulfillmentStartInstructions && o.fulfillmentStartInstructions[0]
    && o.fulfillmentStartInstructions[0].shippingStep
    && o.fulfillmentStartInstructions[0].shippingStep.shipTo) || {};
  const country = (shipTo.contactAddress && shipTo.contactAddress.countryCode) || '';
  const title = item.title || '';
  const titleJa = translateToJa(title);
  return [
    '🛒 **新規注文が入りました！**',
    `**注文ID:** \`${o.orderId}\``,
    `**購入者:** ${buyer.username || '(不明)'}`,
    title ? `**商品:** ${titleJa}${titleJa !== title ? ' _(' + title + ')_' : ''}` : '',
    total.value ? `**金額:** ${total.value} ${total.currency}` : '',
    country ? `**発送先:** ${country}` : '',
    `**ステータス:** ${o.orderFulfillmentStatus || ''}`
  ].filter(s => s !== '').join('\n');
}
function formatOffer(o) {
  const titleJa = translateToJa(o.title);
  return `🎯 **新規 Best Offer**\n` +
    `**商品**: ${titleJa} _(原文: ${o.title})_\n` +
    `**購入希望者**: ${o.buyer}\n` +
    `**金額**: ${o.price}\n` +
    `**ステータス**: ${o.status}\n` +
    `**Item ID**: ${o.itemId} / **Offer ID**: ${o.offerId}`;
}

// ---- 1回分の処理 ----------------------------------------------------------
async function runOnce(cfg) {
  const state = loadState();
  const webhook = cfg.DISCORD_WEBHOOK_URL;
  const seenO = new Set(state.seenOrders);
  const seenF = new Set(state.seenOffers);

  console.log(`\n[${new Date().toLocaleTimeString()}] ポーリング開始 (${webhook ? '本番Discord送信' : 'ドライラン'})`);

  // 注文
  const orders = await fetchOrders();
  const newOrders = orders.filter(o => !seenO.has(String(o.orderId)));
  console.log(`  注文: 取得${orders.length}件 / 新規${newOrders.length}件`);
  for (const o of newOrders) {
    await postToDiscord(formatOrder(o), webhook);
    seenO.add(String(o.orderId));
  }

  // オファー
  const offers = await fetchOffers();
  const newOffers = offers.filter(o => !seenF.has(String(o.offerId)));
  console.log(`  オファー: 取得${offers.length}件 / 新規${newOffers.length}件`);
  for (const o of newOffers) {
    await postToDiscord(formatOffer(o), webhook);
    seenF.add(String(o.offerId));
  }

  state.seenOrders = [...seenO];
  state.seenOffers = [...seenF];
  saveState(state);

  if (newOrders.length === 0 && newOffers.length === 0) {
    console.log('  新規なし（重複防止が機能。state をリセットするには .state.json を削除）');
  }
}

// ---- エントリポイント -----------------------------------------------------
(async () => {
  const cfg = loadConfig();
  const loopIdx = process.argv.indexOf('--loop');
  if (loopIdx !== -1) {
    const sec = parseInt(process.argv[loopIdx + 1] || '30', 10);
    console.log(`ループモード: ${sec}秒間隔 (Ctrl+Cで停止)`);
    const tick = () => runOnce(cfg).catch(e => console.error('ERROR:', e.message));
    await tick();
    setInterval(tick, sec * 1000);
  } else {
    await runOnce(cfg).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
  }
})();
