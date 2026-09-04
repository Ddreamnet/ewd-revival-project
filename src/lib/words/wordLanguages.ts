/**
 * Kelime kartlarının ön yüzündeki dillerin görsel bilgileri.
 *
 * Arayüz dilinden ayrı bir liste: burada "öğrenilen dil" var. Adı sözlükten
 * okunuyor ki liste, ziyaretçinin gezindiği dilde yazılsın — Türkçe gezen biri
 * "Almanca", İngilizce gezen biri "German" görür.
 */
import type { Translations } from "@/lib/siteContent";
import { WORD_LANGUAGES, type WordLanguage } from "./types";

interface WordLanguageMeta {
  code: WordLanguage;
  /** Dar alanlarda kullanılan kısa kod. */
  label: string;
  flagIcon: string;
  /** Sözlükteki `translations.words` anahtarı. */
  nameKey: "langEn" | "langFr" | "langRu" | "langEs" | "langDe" | "langAr";
  /** Sağdan sola yazılan diller — kartın ön yüzü buna göre hizalanır. */
  rtl?: boolean;
}

export const WORD_LANGUAGE_META: Record<WordLanguage, WordLanguageMeta> = {
  en: { code: "en", label: "EN", flagIcon: "/ewd/assets/flags/gb.svg", nameKey: "langEn" },
  fr: { code: "fr", label: "FR", flagIcon: "/ewd/assets/flags/fr.svg", nameKey: "langFr" },
  ru: { code: "ru", label: "RU", flagIcon: "/ewd/assets/flags/ru.svg", nameKey: "langRu" },
  es: { code: "es", label: "ES", flagIcon: "/ewd/assets/flags/es.svg", nameKey: "langEs" },
  de: { code: "de", label: "DE", flagIcon: "/ewd/assets/flags/de.svg", nameKey: "langDe" },
  ar: { code: "ar", label: "AR", flagIcon: "/ewd/assets/flags/sa.svg", nameKey: "langAr", rtl: true },
};

/** Listedeki sıra — açılır menü bu sırayla çizilir. */
export const WORD_LANGUAGE_LIST: WordLanguageMeta[] = WORD_LANGUAGES.map(
  (code) => WORD_LANGUAGE_META[code],
);

/** Kelime dilinin, ziyaretçinin arayüz dilindeki adı. */
export function wordLanguageName(
  t: Translations,
  code: WordLanguage,
  uiLanguage: keyof Translations["words"]["langEn"],
): string {
  return t.words[WORD_LANGUAGE_META[code].nameKey][uiLanguage];
}

/** Kartın ön yüzünün yazı yönü. */
export function wordLanguageDir(code: WordLanguage): "rtl" | "ltr" {
  return WORD_LANGUAGE_META[code].rtl ? "rtl" : "ltr";
}
