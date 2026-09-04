import { EN_WORDS } from "./bank.en";
import { FR_WORDS } from "./bank.fr";
import { RU_WORDS } from "./bank.ru";
import { ES_WORDS } from "./bank.es";
import { DE_WORDS } from "./bank.de";
import { AR_WORDS } from "./bank.ar";
import type { Category, Level, PartOfSpeech, WordBank, WordEntry, WordLanguage } from "./types";

export * from "./types";
export * from "./voice";
export * from "./speechVoices";
export { EN_WORDS, FR_WORDS, RU_WORDS, ES_WORDS, DE_WORDS, AR_WORDS };

export const WORD_BANK: WordBank = {
  en: EN_WORDS,
  fr: FR_WORDS,
  ru: RU_WORDS,
  es: ES_WORDS,
  de: DE_WORDS,
  ar: AR_WORDS,
};

/**
 * Dil başına karıştırma tohumu. Sayılar rastgele seçilmiştir; önemli olan
 * birbirlerinden farklı olmaları — aynı gün her dilde farklı bir üçlü çıksın.
 */
const LANGUAGE_SEEDS: Record<WordLanguage, number> = {
  en: 0x5eed_e11,
  fr: 0x5eed_f12,
  ru: 0x5eed_a13,
  es: 0x5eed_b14,
  de: 0x5eed_c15,
  ar: 0x5eed_d16,
};

/** Günün kelimeleri her sabah bu saatte (yerel saat) yenilenir. */
export const RESET_HOUR = 9;

/**
 * Kartların sırası hiç değişmez: 1. kart isim ya da sıfat, 2. kart fiil,
 * 3. kart zarf. Hem günün kelimelerinde hem de rastgele çekimde geçerlidir.
 */
export const DAILY_SLOTS: readonly (readonly PartOfSpeech[])[] = [
  ["noun", "adjective"],
  ["verb"],
  ["adverb"],
];

/** Kart sayısı — slot sayısı kadar. */
export const CARDS_PER_DAY = DAILY_SLOTS.length;

/** Oklarla en fazla kaç gün geriye gidilebilir. */
export const MAX_HISTORY_DAYS = 30;

/* ------------------------------------------------------------------ zaman */

/**
 * İçinde bulunulan "kelime günü"nün başlangıcı.
 * Saat 09.00'dan önceyse gün dünkü 09.00'da başlamıştır.
 */
export function currentCycleStart(now: Date = new Date()): Date {
  const start = new Date(now);
  if (start.getHours() < RESET_HOUR) {
    start.setDate(start.getDate() - 1);
  }
  start.setHours(RESET_HOUR, 0, 0, 0);
  return start;
}

/** Bir sonraki yenilenme anı — sayaç buraya kadar sayar. */
export function nextResetAt(now: Date = new Date()): Date {
  const next = currentCycleStart(now);
  next.setDate(next.getDate() + 1);
  return next;
}

/**
 * `offset` gün önceki döngünün başlangıcı (0 = bugün, -1 = dün).
 * Saat bileşeni 09.00'da kaldığı için doğrudan `getDailyWords`'e verilebilir.
 */
export function cycleStartFor(offset: number, now: Date = new Date()): Date {
  const start = currentCycleStart(now);
  start.setDate(start.getDate() + offset);
  return start;
}

/** Yenilenmeye kalan süre, saat / dakika / saniye olarak. */
export function timeUntilReset(now: Date = new Date()) {
  const remainingMs = Math.max(0, nextResetAt(now).getTime() - now.getTime());
  const totalSeconds = Math.floor(remainingMs / 1000);
  return {
    totalSeconds,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Döngünün gün numarası. Yaz saati geçişlerinde kaymaması için yerel takvim
 * bileşenlerinden UTC üzerinden hesaplanır.
 */
export function cycleDayIndex(now: Date = new Date()): number {
  const start = currentCycleStart(now);
  return Math.floor(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) / 86_400_000);
}

/* ---------------------------------------------------------------- seçim */

/** Küçük, hızlı ve tohumlanabilir PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Sabit tohumla karıştırılmış kopya — aynı girdi hep aynı sırayı verir. */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface WordFilter {
  level?: Level | "all";
  category?: Category | "all";
}

export function filterWords(language: WordLanguage, filter: WordFilter = {}): WordEntry[] {
  const { level = "all", category = "all" } = filter;
  return WORD_BANK[language].filter(
    (w) => (level === "all" || w.level === level) && (category === "all" || w.category === category),
  );
}

/**
 * Günün kelimeleri — sırayla bir isim/sıfat, bir fiil, bir zarf.
 *
 * Her slotun havuzu sabit bir tohumla bir kez karıştırılır ve gün numarasına
 * göre sırayla okunur. Böylece bir kelime ancak kendi havuzu bittiğinde geri
 * döner (en geniş aralık) ve seçim her cihazda aynı olur. Havuz boyları
 * slotlar arasında farklı olduğu için üçlü kombinasyonlar çok daha uzun süre
 * tekrar etmez.
 */
export function getDailyWords(
  language: WordLanguage,
  now: Date = new Date(),
  level: Level | "all" = "all",
): WordEntry[] {
  const pool = filterWords(language, { level });
  if (pool.length === 0) return [];

  const day = cycleDayIndex(now);
  // Her dil farklı tohum alır ki hiçbir ikisi aynı ritimde ilerlemesin.
  const base = LANGUAGE_SEEDS[language];
  const chosen: WordEntry[] = [];
  const taken = new Set<string>();

  DAILY_SLOTS.forEach((slot, i) => {
    // Slotun türünden kelime yoksa tüm havuza düşülür ki kart sayısı azalmasın.
    const group = pool.filter((w) => slot.includes(w.pos));
    const source = group.length > 0 ? group : pool;
    const order = seededShuffle(source, (base + i * 0x0100_0193) >>> 0);
    const cursor = ((day % order.length) + order.length) % order.length;

    // Yedeğe düşüldüyse aynı kelime iki karta gelebilir; sıradakine kayılır.
    for (let k = 0; k < order.length; k++) {
      const candidate = order[(cursor + k) % order.length];
      if (taken.has(candidate.id)) continue;
      taken.add(candidate.id);
      chosen.push(candidate);
      break;
    }
  });

  return chosen;
}

/** Bir filtre kombinasyonunda kaç kelime olduğunu söyler (boş durum mesajı için). */
export function countWords(language: WordLanguage, filter: WordFilter = {}): number {
  return filterWords(language, filter).length;
}
