/**
 * eBay Marketplace Account Deletion 通知エンドポイント — Cloudflare Worker 版
 *
 * ■ なぜこれが要るか:
 *   GASのウェブアプリは応答時に302リダイレクトを挟むため、eBayの検証で弾かれることが多い。
 *   Cloudflare Workerはリダイレクト無しで素直に200+JSONを返せるので、eBay検証を通しやすい。
 *   完全無料・サーバー不要。
 *
 * ■ デプロイ手順（次回・休んでからでOK）:
 *   1. https://dash.cloudflare.com でアカウント作成（無料）
 *   2. 左メニュー「Workers & Pages」→「Create application」→「Create Worker」
 *   3. 適当な名前（例 ebay-deletion）→ Deploy
 *   4. 「Edit code」でこのファイルの中身を全部貼り付け
 *   5. ★下の ENDPOINT を、発行された Worker のURL（例 https://ebay-deletion.xxxx.workers.dev/）に書き換える★
 *      （eBayに登録するエンドポイントURLと「一字一句」同じにすること）
 *   6. Deploy
 *   7. eBayの「マーケットプレイスアカウント削除」画面で:
 *        - エンドポイント = この Worker のURL
 *        - 検証トークン   = 下の VERIFICATION_TOKEN と同じ
 *      を入れて保存 → 緑/有効になればキーセット有効化
 *
 * ■ 注意:
 *   - VERIFICATION_TOKEN は GAS で生成済みのものをそのまま使用（変えてもよいが両方揃える）
 *   - ENDPOINT は必ず実際の Worker URL に置き換える（ここがズレるとハッシュ不一致で失敗）
 */

const VERIFICATION_TOKEN = "qPwBkp2hw7QRzUxWpMJGhz7NHT5x5GDbEty1tl0LkiaSuci6";

// ★必ず実際の Worker URL に書き換える（末尾スラッシュ有無もeBay登録と完全一致させる）★
const ENDPOINT = "https://REPLACE-WITH-YOUR-WORKER-URL.workers.dev/";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 1) 検証チャレンジ（GET ?challenge_code=XXX）
    if (request.method === "GET") {
      const challengeCode = url.searchParams.get("challenge_code");
      if (challengeCode) {
        const data = challengeCode + VERIFICATION_TOKEN + ENDPOINT;
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
        const hex = [...new Uint8Array(buf)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        return new Response(JSON.stringify({ challengeResponse: hex }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("OK", { status: 200 });
    }

    // 2) 実際のアカウント削除通知（POST）— 200を返すだけ
    if (request.method === "POST") {
      return new Response("", { status: 200 });
    }

    return new Response("", { status: 405 });
  },
};
