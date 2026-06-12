/**
 * F2 AI返信案生成（Claude API）
 *
 * バイヤーのメッセージ + 過去のやり取りを元に、Claude API で返信案を生成する。
 * - 返信言語はバイヤーのメッセージ言語に合わせる（プロンプトで指示）
 * - トーンは丁寧・簡潔な eBay セラー
 * - 過去返信を few-shot として渡し、青田さんの文体に寄せる
 * - 自動送信はしない（生成のみ。送信は人間がDiscordで承認＝F4、デモ範囲外）
 */

/**
 * 返信案を生成して文字列で返す。失敗時は空文字 + ログ。
 * @param {Object} message 正規化済みメッセージ {sender, subject, body, ...}
 * @param {Array<Object>} history 過去やり取り [{role:'buyer'|'seller', text}]
 */
function generateReplyDraft(message, history) {
  const apiKey = getPropOptional('ANTHROPIC_API_KEY');
  if (!apiKey) {
    // キー未設定でも空にせず、キーワードベースの簡易返信案を返す（無料・即動作・ざっくり）。
    // ANTHROPIC_API_KEY を後から設定すれば、自動で本物のAI生成に切り替わる。
    const tmpl = generateTemplateReply_(message);
    logInfo('テンプレ返信案を生成（ANTHROPIC_API_KEY未設定・無料モード）', { messageId: message.messageId });
    return tmpl;
  }

  const systemPrompt = buildSystemPrompt_();
  const userPrompt = buildUserPrompt_(message, history || []);

  try {
    const res = UrlFetchApp.fetch(CONFIG.ANTHROPIC_ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': CONFIG.ANTHROPIC_VERSION
      },
      payload: JSON.stringify({
        model: CONFIG.ANTHROPIC_MODEL,
        max_tokens: CONFIG.ANTHROPIC_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      logError('Claude API エラー', { code: code, body: res.getContentText().slice(0, 300) });
      return '(AI返信案: 生成エラー。手動で返信してください)';
    }
    const data = JSON.parse(res.getContentText());
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
    return text || '(AI返信案: 空の応答)';
  } catch (err) {
    logError('generateReplyDraft 失敗', { error: err.message, messageId: message.messageId });
    return '(AI返信案: 生成エラー。手動で返信してください)';
  }
}

/** システムプロンプト（役割・トーン・制約） */
function buildSystemPrompt_() {
  return [
    'You are an assistant drafting customer-service replies for an eBay seller.',
    'Rules:',
    '- Reply in the SAME language as the buyer\'s latest message (e.g. English buyer -> English reply).',
    '- Tone: polite, concise, professional, friendly. Match the seller\'s past style if examples are provided.',
    '- Do NOT invent facts (shipping dates, tracking numbers, stock) that are not given. If unknown, use a safe placeholder like "[please confirm]".',
    '- Keep it brief: 2-5 sentences unless the buyer asked something complex.',
    '- Output ONLY the reply text. No preamble, no quotes, no explanation.'
  ].join('\n');
}

/** ユーザープロンプト（履歴 few-shot + 今回のメッセージ） */
function buildUserPrompt_(message, history) {
  const lines = [];
  if (history.length > 0) {
    lines.push('# Past conversation (most recent last):');
    history.slice(-CONFIG.REPLY_FEWSHOT_HISTORY).forEach(h => {
      const who = h.role === 'seller' ? 'Seller' : 'Buyer';
      lines.push(`${who}: ${h.text}`);
    });
    lines.push('');
  }
  lines.push('# Buyer\'s latest message to reply to:');
  if (message.subject) lines.push(`Subject: ${message.subject}`);
  lines.push(`From: ${message.sender || 'buyer'}`);
  lines.push(`Message: ${message.body || ''}`);
  lines.push('');
  lines.push('Draft the seller\'s reply now.');
  return lines.join('\n');
}

/**
 * 【手動テスト用】サンプルのバイヤーメッセージでAI返信案を生成し、ログに出力する。
 *
 * 使い方:
 *   1. GASのスクリプトプロパティに ANTHROPIC_API_KEY（しゅんすけ提供）を登録
 *   2. GASエディタでこの関数 testAiReplyDraft を選んで「実行」
 *   3. 実行ログに英語の返信案が出れば本番AI稼働OK
 *      （"ANTHROPIC_API_KEY 未設定のためスキップ" と出たらキー未登録 or 名前ミス）
 *
 * これは送信を一切行わない安全なテスト（生成のみ）。
 */
function testAiReplyDraft() {
  const sample = {
    messageId: 'TEST-AI-001',
    sender: 'buyer_john',
    subject: 'Question about shipping',
    body: 'Hi, I just bought your 50mm camera lens. When will it ship, and will I get a tracking number?'
  };
  const history = [
    { role: 'buyer',  text: 'Is this lens compatible with the Canon EF mount?' },
    { role: 'seller', text: 'Yes, it is fully compatible with the Canon EF mount. Thank you for your interest!' }
  ];

  const keySet = !!getPropOptional('ANTHROPIC_API_KEY');
  const draft = generateReplyDraft(sample, history);

  Logger.log('==== AI返信案テスト ====');
  Logger.log('ANTHROPIC_API_KEY: ' + (keySet ? '設定あり（本物のAI生成）' : '未設定（無料のテンプレ返信案が返ります）'));
  Logger.log('--- 生成された返信案 ---');
  Logger.log(draft);
  logInfo('testAiReplyDraft 実行', { keySet: keySet, draft: String(draft).slice(0, 300) });
  return draft;
}

/**
 * 【無料・キー不要】キーワードベースの簡易返信案ジェネレータ。
 *
 * バイヤーのメッセージ内の語を見て、最も近いカテゴリの定型文を返す。
 * AIではないので内容は"ざっくり"だが、ANTHROPIC_API_KEY 無しで即動く。
 * 文中の [ ] はセラーが具体値（日付・追跡番号・価格など）を埋める前提のプレースホルダ。
 * 日本語メッセージには日本語、それ以外は英語で返す（簡易判定）。
 */
function generateTemplateReply_(message) {
  const raw = String((message && message.body) || '');
  const body = raw.toLowerCase();
  const isJa = /[぀-ヿ㐀-鿿]/.test(raw); // ひらがな/カタカナ/漢字を含むか

  // カテゴリ判定（上から優先。最初に一致したものを採用）
  const rules = [
    { cat: 'tracking', keys: ['track', 'tracking', 'trace'] },
    { cat: 'shipping', keys: ['ship', 'shipping', 'dispatch', 'when will', 'send it'] },
    { cat: 'delivery', keys: ['where', 'arrive', 'arrived', 'delivery', 'delivered', 'received', "haven't", 'not here', 'late', 'still waiting'] },
    { cat: 'refund',   keys: ['refund', 'return', 'money back', 'reimburse'] },
    { cat: 'cancel',   keys: ['cancel', 'cancellation'] },
    { cat: 'damaged',  keys: ['broken', 'damaged', 'defective', 'not working', "doesn't work", 'faulty', 'wrong item'] },
    { cat: 'offer',    keys: ['offer', 'discount', 'lower price', 'cheaper', 'best price', 'reduce', 'deal'] },
    { cat: 'product',  keys: ['size', 'color', 'colour', 'compatible', 'spec', 'work with', 'does it fit', 'condition'] },
    { cat: 'thanks',   keys: ['thank', 'thanks', 'great seller', 'perfect', 'love it', 'received it'] }
  ];
  let cat = 'generic';
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].keys.some(function (k) { return body.indexOf(k) !== -1; })) { cat = rules[i].cat; break; }
  }

  const EN = {
    tracking: 'Hi, thank you for your message! Your tracking number is [tracking number], and you can check the latest status here: [carrier link]. Please let me know if you have any other questions.',
    shipping: 'Hi, thank you for your order! Your item is scheduled to ship by [date] and usually arrives within [X] days. I will send you the tracking number as soon as it ships.',
    delivery: 'Hi, thank you for reaching out, and I am sorry for any concern. According to the tracking, your item is currently [status]. If it has not arrived by [date], please let me know and I will resolve it for you right away.',
    refund:   'Hi, thank you for contacting me, and I am sorry for the trouble. I can help with a return/refund. Could you confirm [reason/condition]? I will then send you the next steps right away.',
    cancel:   'Hi, thank you for letting me know. I can cancel this order for you. As it has [not shipped yet / already shipped], I will [process the cancellation / arrange a return]. I will follow up shortly.',
    damaged:  'Hi, I am very sorry the item arrived in this condition. Could you please send a photo of the issue? Once I confirm, I will make it right with a replacement or full refund. Thank you for your patience.',
    offer:    'Hi, thank you for your interest! I can offer it at [price]. If that works for you, just let me know and I will set it up.',
    product:  'Hi, thank you for your question. Regarding [size/color/compatibility]: [answer]. Please let me know if you need any more details before purchasing.',
    thanks:   'Hi, thank you so much for your kind message and for your purchase! It was a pleasure doing business with you. Please feel free to reach out anytime.',
    generic:  'Hi, thank you for your message! [Your answer to the buyer here]. Please let me know if there is anything else I can help you with.'
  };
  const JA = {
    tracking: 'ご連絡ありがとうございます。追跡番号は[追跡番号]です。最新状況は[配送業者リンク]からご確認いただけます。他にご不明点があればお知らせください。',
    shipping: 'ご注文ありがとうございます。商品は[日付]までに発送予定で、通常[X]日ほどで到着します。発送次第、追跡番号をお送りします。',
    delivery: 'ご連絡ありがとうございます。ご不安をおかけし申し訳ありません。追跡上、現在のステータスは[ステータス]です。[日付]までに届かない場合はお知らせください。すぐに対応いたします。',
    refund:   'ご連絡ありがとうございます。ご不便をおかけし申し訳ありません。返品・返金の対応が可能です。[理由・状態]をご確認のうえご返信ください。手続きをご案内します。',
    cancel:   'ご連絡ありがとうございます。キャンセルを承ります。現在[未発送/発送済み]のため、[キャンセル処理/返品手配]をいたします。追ってご連絡いたします。',
    damaged:  'この度は商品の状態でご迷惑をおかけし申し訳ありません。状態のわかる写真をお送りいただけますか。確認次第、交換または全額返金で必ず対応いたします。',
    offer:    'ご関心ありがとうございます。[価格]でご提供可能です。よろしければ手配いたしますのでお知らせください。',
    product:  'ご質問ありがとうございます。[サイズ/色/対応可否]について：[回答]。ご購入前に他にご不明点があればお気軽にどうぞ。',
    thanks:   '温かいメッセージとご購入を誠にありがとうございます。お取引できて光栄です。何かあればいつでもご連絡ください。',
    generic:  'ご連絡ありがとうございます。[ご質問への回答]。他にもお手伝いできることがあればお知らせください。'
  };

  return (isJa ? JA : EN)[cat];
}
