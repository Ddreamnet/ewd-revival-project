import type { Category } from "@/lib/words";

/**
 * Kart renk şeması. Üç kart yan yana dizildiğinde mor → pembe → sarı ritmi
 * oluşsun diye indekse göre sırayla uygulanır.
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

export const CARD_TONES: CardTone[] = [
  {
    bg: "#A253BE",
    panel: "#F4E6FB",
    ink: "#FFF8EF",
    inkSoft: "#EBD3F7",
    edge: "#C9B6F5",
    accent: "#6D28D9",
    wash: "#F7EFFF",
    base: "#7E3D96",
  },
  {
    bg: "#EC4899",
    panel: "#FFE3F0",
    ink: "#FFF8EF",
    inkSoft: "#FBD5E4",
    edge: "#F8C8DC",
    accent: "#BE185D",
    wash: "#FFF1F7",
    base: "#BE185D",
  },
  {
    bg: "#FBD34F",
    panel: "#FFF6DA",
    ink: "#2E1065",
    inkSoft: "#6B4A00",
    edge: "#F0CB68",
    accent: "#8A6410",
    wash: "#FFFAEA",
    base: "#D9A21B",
  },
];

export function toneFor(index: number): CardTone {
  return CARD_TONES[index % CARD_TONES.length];
}

/** Konuya göre 3D obje — set `public/ewd/assets/ic/` içinde. */
const CATEGORY_ART: Record<Category, string> = {
  daily: "ic-saat.png",
  school: "ic-abc.png",
  work: "y-hedef.png",
  feelings: "n-sohbet.png",
  travel: "y-canta.png",
  food: "gift.png",
  nature: "ic-oyun.png",
  people: "n-ikili.png",
  home: "ic-kitap-p.png",
  body: "y-kulaklik.png",
  time: "fi-takvim.png",
  tech: "fi-laptop.png",
};

export function artFor(category: Category): string {
  return `/ewd/assets/ic/${CATEGORY_ART[category]}`;
}
