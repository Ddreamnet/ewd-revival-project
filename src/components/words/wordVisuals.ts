import type { PartOfSpeech } from "@/lib/words";

/**
 * Kart renk şeması. Renk kelimenin türünden gelir: her tür her zaman aynı
 * rengi taşır, böylece kart daha okunmadan türü belli olur.
 */
export interface CardTone {
  /** Ön yüz zemini */
  bg: string;
  /** Ön yüzdeki açık renkli resim paneli */
  panel: string;
  /** Ön yüz metni */
  ink: string;
  /** Ön yüzün ikincil metni */
  inkSoft: string;
  /** Arka yüz kenarı ve vurguları */
  edge: string;
  /** Arka yüzdeki başlık rengi */
  accent: string;
  /** Arka yüzdeki yumuşak zemin */
  wash: string;
  /** Katı gölge tabanı */
  base: string;
}

export const POS_TONES: Record<PartOfSpeech, CardTone> = {
  // isim — mor
  noun: {
    bg: "#A253BE",
    panel: "#F4E6FB",
    ink: "#FFF8EF",
    inkSoft: "#EBD3F7",
    edge: "#C9B6F5",
    accent: "#6D28D9",
    wash: "#F7EFFF",
    base: "#7E3D96",
  },
  // sıfat — turkuaz
  adjective: {
    bg: "#14B8A6",
    panel: "#DDF7F3",
    ink: "#FFF8EF",
    inkSoft: "#C3EFE8",
    edge: "#8FDFD3",
    accent: "#0F766E",
    wash: "#ECFDF9",
    base: "#0D9488",
  },
  // fiil — pembe
  verb: {
    bg: "#EC4899",
    panel: "#FFE3F0",
    ink: "#FFF8EF",
    inkSoft: "#FBD5E4",
    edge: "#F8C8DC",
    accent: "#BE185D",
    wash: "#FFF1F7",
    base: "#BE185D",
  },
  // zarf — sarı
  adverb: {
    bg: "#FBD34F",
    panel: "#FFF6DA",
    ink: "#2E1065",
    inkSoft: "#6B4A00",
    edge: "#F0CB68",
    accent: "#8A6410",
    wash: "#FFFAEA",
    base: "#D9A21B",
  },
  // kalıp — turuncu
  phrase: {
    bg: "#F97316",
    panel: "#FFEBD9",
    ink: "#FFF8EF",
    inkSoft: "#FCD9B8",
    edge: "#F7C48F",
    accent: "#C2410C",
    wash: "#FFF4EA",
    base: "#C2410C",
  },
};

/** Kartın rengi kelimenin türüyle sabittir. */
export function toneFor(pos: PartOfSpeech): CardTone {
  return POS_TONES[pos];
}
