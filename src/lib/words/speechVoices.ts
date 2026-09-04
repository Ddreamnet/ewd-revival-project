import type { WordLanguage } from "./types";

/**
 * Tarayıcı konuşma motorunda ses seçimi.
 *
 * Ses belirtilmezse tarayıcı kendi varsayılanını kullanır ve bu çoğu cihazda
 * eldeki en kötü sestir: Windows'ta "Microsoft David Desktop", Linux'ta eSpeak,
 * Android'de sıkıştırılmış yerel motor. Oysa aynı tarayıcıda genelde çok daha
 * iyi nöral sesler kayıtlıdır — Edge'de "… Online (Natural)", Chrome'da
 * "Google UK English", Apple'da indirilmiş "Enhanced/Premium" sesler. Burada
 * mevcut sesler puanlanıp en iyisi seçilir.
 */

/** Kelimenin dili için tercih edilen yerel ayar (küçük harf, karşılaştırma için). */
const PREFERRED_LOCALE: Record<WordLanguage, string> = {
  en: "en-gb",
  fr: "fr-fr",
  ru: "ru-ru",
  es: "es-es",
  de: "de-de",
  ar: "ar-sa",
};

/** Uygun ses bulunamazsa `utterance.lang` buraya düşer. */
const FALLBACK_LANG: Record<WordLanguage, string> = {
  en: "en-GB",
  fr: "fr-FR",
  ru: "ru-RU",
  es: "es-ES",
  de: "de-DE",
  ar: "ar-SA",
};

/** Nöral / yüksek kaliteli motorları ele veren isim ipuçları. */
const QUALITY_HINTS: readonly (readonly [RegExp, number])[] = [
  [/natural/i, 6], // Edge: "Microsoft Sonia Online (Natural) - English (UK)"
  [/neural/i, 6],
  [/premium|enhanced/i, 5], // Apple'ın indirilebilir kaliteli sesleri
  [/google/i, 5], // Chrome ve Android
  [/siri/i, 4],
  [/online/i, 3], // ağdan gelen sesler yerel olanlardan iyi
];

/** Bilinen düşük kaliteli motorlar. */
const POOR_HINTS: readonly (readonly [RegExp, number])[] = [
  [/espeak/i, -8],
  [/compact/i, -4],
  [/desktop/i, -3],
];

/**
 * Ses listesi tarayıcıya sonradan yüklenir; ilk `getVoices()` çağrısı çoğu
 * tarayıcıda boş döner. Yüklendiğinde burada saklanır.
 */
let cachedVoices: SpeechSynthesisVoice[] = [];
let listening = false;

function synth(): SpeechSynthesis | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  return window.speechSynthesis;
}

function readVoices(): SpeechSynthesisVoice[] {
  const list = synth()?.getVoices() ?? [];
  if (list.length > 0) cachedVoices = list;
  return cachedVoices;
}

/**
 * Ses listesini önceden yükletir. Kart açılır açılmaz çağrılır ki kullanıcı
 * hoparlöre bastığında liste hazır olsun, ilk okuma varsayılan sese düşmesin.
 */
export function primeVoices(): void {
  const speech = synth();
  if (!speech) return;
  readVoices();
  if (listening) return;
  listening = true;
  speech.addEventListener("voiceschanged", readVoices);
}

function scoreVoice(voice: SpeechSynthesisVoice, wordLanguage: WordLanguage): number {
  const locale = voice.lang.replace("_", "-").toLowerCase();
  if (!locale.startsWith(wordLanguage)) return Number.NEGATIVE_INFINITY;

  let score = 0;
  if (locale === PREFERRED_LOCALE[wordLanguage]) score += 3;
  // Ağ üzerinden gelen sesler cihazdaki sıkıştırılmış seslerden temiz çıkar.
  if (!voice.localService) score += 2;
  for (const [pattern, weight] of QUALITY_HINTS) if (pattern.test(voice.name)) score += weight;
  for (const [pattern, weight] of POOR_HINTS) if (pattern.test(voice.name)) score += weight;
  if (voice.default) score += 1;
  return score;
}

/** Kelimenin dili için eldeki en iyi ses; hiç uygun ses yoksa `undefined`. */
export function pickVoice(wordLanguage: WordLanguage): SpeechSynthesisVoice | undefined {
  let best: SpeechSynthesisVoice | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const voice of readVoices()) {
    const score = scoreVoice(voice, wordLanguage);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

/** Tek kelime mi cümle mi — okuma hızı buna göre ayarlanır. */
export type SpeechKind = "word" | "example";

/**
 * Okumayı hazırlar: en iyi sesi, dili ve hızı yerleştirir. Tek kelimeler
 * öğrenci tekrar edebilsin diye biraz yavaş, cümleler doğal tempoda okunur.
 */
export function configureUtterance(
  utterance: SpeechSynthesisUtterance,
  wordLanguage: WordLanguage,
  kind: SpeechKind,
): void {
  const voice = pickVoice(wordLanguage);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = FALLBACK_LANG[wordLanguage];
  }
  utterance.rate = kind === "word" ? 0.9 : 0.95;
  utterance.pitch = 1;
}
