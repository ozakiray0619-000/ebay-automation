/**
 * F-02 英→日 自動翻訳
 *
 * LanguageApp.translate() を使用（無料、日次クォータあり）。
 * 同一文字列の重複翻訳を避けるため、シート内キャッシュ + ScriptCache を併用。
 */

/** 英文 → 日本語訳。空文字や非英語はそのまま返す */
function translateToJa(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';

  // ScriptCache で同一文字列を再翻訳しない（最大 6時間保持）
  const cache = CacheService.getScriptCache();
  const key = 'tr:' + Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, trimmed)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const ja = LanguageApp.translate(trimmed, CONFIG.TRANSLATE_FROM, CONFIG.TRANSLATE_TO);
    cache.put(key, ja, 21600); // 6h
    return ja;
  } catch (err) {
    logError('translateToJa failed', { text: trimmed.slice(0, 80), error: err.message });
    return trimmed; // フォールバック: 原文を返す
  }
}
