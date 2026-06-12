/**
 * F-02 英→日 自動翻訳
 *
 * LanguageApp.translate() を使用（無料、日次クォータあり）。
 * 同一文字列の重複翻訳を避けるため、シート内キャッシュ + ScriptCache を併用。
 */

/**
 * テキストが日本語（ひらがな・カタカナ・漢字）を含むか判定。
 * 含む場合は翻訳不要としてスキップする。
 */
function isAlreadyJapanese_(text) {
  // ひらがな: ぀-ゟ  カタカナ: ゠-ヿ  CJK漢字: 一-鿿
  return /[぀-ゟ゠-ヿ一-鿿]/.test(text);
}

/** 英文 → 日本語訳。空文字・日本語テキストはそのまま返す */
function translateToJa(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';

  // すでに日本語が含まれていれば翻訳不要（クォータ節約）
  if (isAlreadyJapanese_(trimmed)) return trimmed;

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
