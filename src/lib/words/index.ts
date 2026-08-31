import { EN_WORDS } from "./bank.en";
import { FR_WORDS } from "./bank.fr";
import type { Category, Level, WordBank, WordEntry, WordLanguage } from "./types";

export * from "./types";
export { EN_WORDS, FR_WORDS };

export const WORD_BANK: WordBank = { en: EN_WORDS, fr: FR_WORDS };

/** Günün kelimeleri her akşam bu saatte (yerel saat) yenilenir. */
export const RESET_HOUR = 20;

/** Kart sayısı — hem günün seçiminde hem rastgele çekimde. */
export const CARDS_PER_DAY = 3;

/* ------------------------------------------------------------------ zaman */

/**
 * İçinde bulunulan "kelime günü"nün başlangıcı.
 * Saat 20.00'den önceyse gün dünkü 20.00'de başlamıştır.
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
 * Günün kelimeleri.
 *
 * Havuz sabit bir tohumla bir kez karıştırılır, sonra gün numarasına göre
 * üçlü pencereler hâlinde okunur — böylece havuz tükenene kadar hiçbir kelime
 * tekrar etmez ve seçim her cihazda aynı olur.
 */
export function getDailyWords(
  language: WordLanguage,
  now: Date = new Date(),
  count: number = CARDS_PER_DAY,
): WordEntry[] {
  const pool = WORD_BANK[language];
  if (pool.length === 0) return [];

  // Diller farklı tohum alır ki İngilizce ve Fransızca aynı ritimde ilerlemesin.
  const order = seededShuffle(pool, language === "en" ? 0x5eed_e11 : 0x5eed_f12);
  const windows = Math.max(1, Math.floor(order.length / count));
  const offset = (((cycleDayIndex(now) % windows) + windows) % windows) * count;

  return Array.from({ length: Math.min(count, order.length) }, (_, i) => order[(offset + i) % order.length]);
}

/** Filtreye uyan havuzdan rastgele `count` kelime — her çağrıda değişir. */
export function drawRandomWords(
  language: WordLanguage,
  filter: WordFilter = {},
  count: number = CARDS_PER_DAY,
): WordEntry[] {
  const pool = filterWords(language, filter);
  if (pool.length === 0) return [];
  return seededShuffle(pool, (Math.random() * 2 ** 32) >>> 0).slice(0, Math.min(count, pool.length));
}

/** Bir filtre kombinasyonunda kaç kelime olduğunu söyler (boş durum mesajı için). */
export function countWords(language: WordLanguage, filter: WordFilter = {}): number {
  return filterWords(language, filter).length;
}
