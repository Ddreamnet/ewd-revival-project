import type { Language } from "@/lib/translations";

/** Öğrenilen dil — kelime kartlarının ön yüzü bu dilde. */
export type WordLanguage = "en" | "fr";

/** Avrupa Dil Portfolyosu seviyeleri. */
export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];

/** Kart konuları — `translations.words.categories` ile aynı anahtarlar. */
export const CATEGORIES = [
  "daily",
  "school",
  "work",
  "feelings",
  "travel",
  "food",
  "nature",
  "people",
  "home",
  "body",
  "time",
  "tech",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "phrase";

export interface WordEntry {
  /** Kararlı kimlik — günlük seçimde ve React anahtarlarında kullanılır. */
  id: string;
  /** Kartın ön yüzündeki kelime. */
  word: string;
  pos: PartOfSpeech;
  level: Level;
  category: Category;
  /** IPA okunuşu. */
  phonetic: string;
  /** Kısa karşılık — arayüz diline göre okunur. */
  meaning: Record<Language, string>;
  /** Kelimenin kendi dilindeki örnek cümle. */
  example: string;
  /**
   * Örnek cümlenin çevirileri. Kelimenin dili arayüz diliyle aynıysa
   * (İngilizce kelime + İngilizce arayüz) çeviri gösterilmez, bu yüzden
   * o dil burada bulunmaz.
   */
  exampleT: Partial<Record<Language, string>>;
  synonyms: string[];
  antonym?: string;
}

/** Kelime bankasının dile göre bölümü. */
export type WordBank = Record<WordLanguage, WordEntry[]>;
