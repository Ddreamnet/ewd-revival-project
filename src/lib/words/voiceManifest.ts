/**
 * OTOMATİK ÜRETİLİR — elle düzenleme. Yenilemek için: `node scripts/voice/sync-manifest.mjs`
 *
 * `public/audio/` altında sesi hazır olan kelimelerin kimlikleri. Listede olmayan
 * kelimeler tarayıcının konuşma motoruyla okunur.
 */

/** Kayıtlı kelime sesi olan kimlikler. */
export const VOICE_WORD_IDS = new Set<string>([]);

/** Kayıtlı örnek cümle sesi olan kimlikler. */
export const VOICE_EXAMPLE_IDS = new Set<string>([]);
