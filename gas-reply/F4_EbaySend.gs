/**
 * F4_EbaySend.gs — eBay 送信API（ワンクリック送信の実処理）
 *
 * 送信    : Trading API AddMemberMessageRTQ（バイヤーへの返信）
 * 受諾/拒否 : Trading API RespondToBestOffer（Accept / Decline）
 *
 * eBay 本番 Keyset 審査が未完のため、既定では MOCK モード（実送信せずログのみ）。
 * 本番接続できたら Script Property "F4_MOCK_SEND" = "false" にすると実 API を叩く。
 *
 * 依存: callTrading_()（F1_Messages.gs）/ truncate_()（F3_Discord.gs）/ logInfo 等
 */

/** MOCK 送信かどうか（既定 true = 実送信しない） */
function isMockSend_() {
  const v = (getPropOptional('F4_MOCK_SEND') || 'true').toLowerCase();
  return v !== 'false';
}

/**
 * バイヤーへ返信を送信。
 * opts: { itemId, recipientId, parentMessageId, body }
 * 戻り値: { ok:true, mock:boolean }
 */
function ebaySendMemberMessage_(opts) {
  if (isMockSend_()) {
    logInfo('F4 MOCK: AddMemberMessageRTQ（実送信せず）', {
      to: opts.recipientId, itemId: opts.itemId, body: truncate_(opts.body, 200)
    });
    return { ok: true, mock: true };
  }
  if (!opts.itemId) throw new Error('ItemID が無いため実送信できません（返信ログに ItemID 列を追加して保存する必要があります）。');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${escapeXml_(getProp('EBAY_AUTH_TOKEN'))}</eBayAuthToken></RequesterCredentials>
  <ItemID>${escapeXml_(opts.itemId)}</ItemID>
  <MemberMessage>
    <Body>${escapeXml_(opts.body)}</Body>
    <ParentMessageID>${escapeXml_(opts.parentMessageId)}</ParentMessageID>
    <RecipientID>${escapeXml_(opts.recipientId)}</RecipientID>
  </MemberMessage>
</AddMemberMessageRTQRequest>`;
  const res = callTrading_('AddMemberMessageRTQ', xml);
  assertAck_(res, 'AddMemberMessageRTQ');
  return { ok: true, mock: false };
}

/**
 * Best Offer に応答（Accept / Decline）。
 * opts: { itemId, bestOfferId, action }  action: 'Accept' | 'Decline'
 * 戻り値: { ok:true, mock:boolean }
 */
function ebayRespondToBestOffer_(opts) {
  if (isMockSend_()) {
    logInfo('F4 MOCK: RespondToBestOffer（実送信せず）', {
      itemId: opts.itemId, offer: opts.bestOfferId, action: opts.action
    });
    return { ok: true, mock: true };
  }
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<RespondToBestOfferRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${escapeXml_(getProp('EBAY_AUTH_TOKEN'))}</eBayAuthToken></RequesterCredentials>
  <ItemID>${escapeXml_(opts.itemId)}</ItemID>
  <BestOfferID>${escapeXml_(opts.bestOfferId)}</BestOfferID>
  <Action>${escapeXml_(opts.action)}</Action>
</RespondToBestOfferRequest>`;
  const res = callTrading_('RespondToBestOffer', xml);
  assertAck_(res, 'RespondToBestOffer');
  return { ok: true, mock: false };
}

/** Trading API レスポンスの Ack を検証（Success/Warning 以外は例外） */
function assertAck_(xmlText, callName) {
  const doc = XmlService.parse(xmlText);
  const root = doc.getRootElement();
  const ns = root.getNamespace();
  const ack = root.getChild('Ack', ns);
  const ackVal = ack ? ack.getText() : '';
  if (ackVal !== 'Success' && ackVal !== 'Warning') {
    throw new Error(`${callName} Ack=${ackVal}: ${truncate_(xmlText, 500)}`);
  }
}

/** XML エスケープ */
function escapeXml_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
