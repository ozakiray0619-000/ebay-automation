/**
 * DiscordService.gs — Discord Webhook 投稿
 */

function postToDiscord(content) {
  const url = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK_URL');
  if (!url) {
    // Webhook 未設定なら logs シートに記録するだけにする（Phase 1モック検証用）
    logInfo('Discord webhook not configured — skipping post', { content: String(content).slice(0, 200) });
    return;
  }
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ content: content }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code !== 204 && code !== 200) {
    throw new Error(`Discord webhook ${code}: ${res.getContentText()}`);
  }
}
