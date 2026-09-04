import type { WordEntry } from "./types";
import { VOICE_EXAMPLE_IDS, VOICE_WORD_IDS } from "./voiceManifest";

/**
 * Kelime seslendirmeleri. Kayıtlı MP3 varsa o çalınır; yoksa kart tarayıcının
 * kendi konuşma motoruna düşer (bkz. `useWordVoice`).
 *
 * Dosyalar `scripts/voice/` altındaki akışla üretilir ve `public/audio/` altına
 * yazılır; hangi kelimenin sesi hazır olduğunu `voiceManifest.ts` tutar.
 */

/**
 * Seslendirilecek metin.
 *
 * Kartın ön yüzünde isimler tanımlığıyla yazılıyor (cinsiyet öğrenmenin
 * parçası: "la maison", "el libro", "das Haus"). Okunurken tanımlık düşer ki
 * öğrenci kelimenin kendisini duysun. Arapçadaki "ال" kelimeye bitişik
 * yazıldığı için burada ayrılmaz; Rusçada tanımlık yoktur.
 */
const LEADING_ARTICLE = /^(le |la |l'|les |el |los |las |der |die |das )/;

export function spokenWord(entry: WordEntry): string {
  return entry.word.replace(LEADING_ARTICLE, "");
}

/** Kayıtlı kelime sesi; yoksa `undefined`. */
export function wordVoiceSrc(entry: WordEntry): string | undefined {
  return VOICE_WORD_IDS.has(entry.id) ? `/audio/words/${entry.id}.mp3` : undefined;
}

/** Kayıtlı örnek cümle sesi; yoksa `undefined`. */
export function exampleVoiceSrc(entry: WordEntry): string | undefined {
  return VOICE_EXAMPLE_IDS.has(entry.id) ? `/audio/examples/${entry.id}.mp3` : undefined;
}
