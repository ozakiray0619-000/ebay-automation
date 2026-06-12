/**
 * AccountDeletion.gs — eBay Marketplace Account Deletion / Closure Notification
 *
 * ■ 何のため:
 *   eBay は2021年以降、すべての本番アプリに「ユーザーがアカウントを削除/閉鎖した時の
 *   通知を受け取るエンドポイント」を必須化している。これを設定しないと本番キーセットが
 *   「無効（non-compliant / 非協力）」になり、本番APIが一切使えない。
 *   このファイルはその要件を満たすための最小実装。
 *
 * ■ 仕組み:
 *   1. eBayが endpoint に GET ?challenge_code=XXX を送ってくる（登録時の検証）
 *   2. こちらは SHA-256( challengeCode + verificationToken + endpoint ) を hex で返す
 *      → doGet() が challenge_code を見て handleEbayDeletionChallenge() に振り分け
 *   3. 実際にユーザーが削除された時は POST で通知が来る → doPost() が 200 で受ける
 *
 * ■ 必要なスクリプトプロパティ:
 *   EBAY_VERIFICATION_TOKEN : 32〜80文字の任意文字列（英数字・_・- のみ）。自分で決める。
 *                             例: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 *   WEBAPP_URL              : このウェブアプリの /exec URL。
 *                             ★eBayに登録する endpoint と「一字一句」同じであること★
 */

/** eBay の検証チャレンジに応答する（GET ?challenge_code=XXX） */
function handleEbayDeletionChallenge(challengeCode) {
  const verificationToken = getProp('EBAY_VERIFICATION_TOKEN');
  const endpoint = getProp('WEBAPP_URL');

  // ハッシュ対象は必ず challengeCode → verificationToken → endpoint の順で連結
  const raw = challengeCode + verificationToken + endpoint;
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8
  );
  // 符号付きバイト → 2桁hex に変換
  const hex = bytes.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');

  logInfo('eBay deletion challenge answered', { challenge: String(challengeCode).slice(0, 12) });

  return ContentService
    .createTextOutput(JSON.stringify({ challengeResponse: hex }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 実際のアカウント削除通知を受ける（POST）。記録して 200 を返すだけ。 */
function doPost(e) {
  try {
    logInfo('eBay account deletion notification received', {
      body: (e && e.postData) ? String(e.postData.contents).slice(0, 500) : ''
    });
  } catch (err) {
    logError('doPost (deletion) failed', { error: err.message });
  }
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

/**
 * 検証トークンを自動生成してスクリプトプロパティに保存するヘルパ。
 * GASエディタで一度だけ実行すると EBAY_VERIFICATION_TOKEN が作られる。
 * 実行ログにトークンが出るので、eBay登録画面にも同じものを貼る。
 */
function generateVerificationToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let t = '';
  for (let i = 0; i < 48; i++) {
    t += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  PropertiesService.getScriptProperties().setProperty('EBAY_VERIFICATION_TOKEN', t);
  Logger.log('EBAY_VERIFICATION_TOKEN を生成・保存しました:\n' + t +
    '\n\nこの文字列を、eBayのアカウント削除通知 登録画面の「Verification token」にも貼ってください。');
  return t;
}
