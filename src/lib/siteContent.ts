// ============================================================================
// SİTE İÇERİĞİ — ADMİN PANELİNDEN DÜZENLENEN LANDING METİNLERİ
// ============================================================================
// Landing sayfası varsayılan olarak `@/lib/translations` sözlüğünü okur. Admin
// panelinden yapılan değişiklikler `site_content` tablosunda **yol → değer**
// çiftleri olarak durur (örn. "hero.title" → {tr,en,fr,ru,es,de,ar}); burada o
// kayıtlar sözlüğün üstüne bindirilir. Kaydı olmayan alan varsayılanıyla
// kalır, yani tablo boşken site bugünkü haliyle çalışır.

import { LANGUAGE_CODES, translations, type Language } from "@/lib/translations";

export type Translations = typeof translations;
export type LocalizedValue = Record<Language, string>;

/** Sözlüğün ve `site_content` satırlarının dil sırası. */
export const CONTENT_LANGUAGES = LANGUAGE_CODES;

/** Her dili boş bırakan yeni bir metin demeti — admin formlarının başlangıcı. */
export function emptyLocalized(): LocalizedValue {
  return Object.fromEntries(CONTENT_LANGUAGES.map((code) => [code, ""])) as LocalizedValue;
}

/** Bir yaprak, her dili dolu bir metin demeti mi? */
export function isLocalized(value: unknown): value is LocalizedValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return CONTENT_LANGUAGES.every((code) => typeof record[code] === "string");
}

// ─── Yol işlemleri ────────────────────────────────────────────────────────

export function getAtPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, segment) => {
    if (node == null || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[segment];
  }, root);
}

/** `root` üzerinde yolu izleyip son parçayı `value` ile değiştirir (yerinde). */
export function setAtPath(root: unknown, path: string, value: unknown): void {
  const segments = path.split(".");
  let node = root as Record<string, unknown> | undefined;
  for (const segment of segments.slice(0, -1)) {
    if (node == null || typeof node !== "object") return;
    node = node[segment] as Record<string, unknown> | undefined;
  }
  if (node == null || typeof node !== "object") return;
  node[segments[segments.length - 1]] = value;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ─── Düzenlenebilir alanların çıkarılması ─────────────────────────────────

export interface EditableField {
  /** Nokta ile ayrılmış yol — `site_content.key` ile birebir aynı. */
  path: string;
  /** Yolun son anlamlı parçalarından türetilmiş okunur etiket. */
  label: string;
  /** Varsayılan (kod içindeki) değer — "sıfırla" bunun üstüne döner. */
  fallback: LocalizedValue;
  /** Tek satırlık kutu mu, çok satırlı mı — uzunluğa göre. */
  multiline: boolean;
}

export interface EditableSection {
  key: string;
  label: string;
  fields: EditableField[];
}

/** Kendi yöneticisi olan bölümler burada listelenmez. */
const MANAGED_ELSEWHERE = new Set(["testimonials.items", "moments.shots", "moments.clips"]);

const SECTION_LABELS: Record<string, string> = {
  header: "Üst menü",
  hero: "Açılış bölümü",
  marquee: "Kayan şerit",
  stickyBubble: "Sabit balon",
  why: "Neden biz",
  kidsPackages: "Çocuk paketleri",
  adultPackages: "Yetişkin paketleri",
  faq: "Sık sorulan sorular",
  blog: "Blog bölümü",
  values: "Değerlerimiz",
  contact: "İletişim",
  footer: "Alt bilgi",
  words: "Günün kelimeleri",
  workWithUs: "Bizimle çalışın sayfası",
  privacyPolicy: "Gizlilik politikası sayfası",
  moments: "Dersten kareler (başlıklar)",
  testimonials: "Veli yorumları (başlıklar)",
};

/** "kidsPackages.classicPackage.items.speaking.title" → "Classic package › speaking › title" */
function labelFromPath(path: string): string {
  return path
    .split(".")
    .slice(1)
    .filter((segment) => segment !== "items" && segment !== "questions")
    .map((segment) =>
      /^\d+$/.test(segment)
        ? `#${Number(segment) + 1}`
        : segment.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()),
    )
    .join(" › ");
}

function walk(node: unknown, path: string, out: EditableField[]): void {
  if (MANAGED_ELSEWHERE.has(path)) return;

  if (isLocalized(node)) {
    out.push({
      path,
      label: labelFromPath(path) || path,
      fallback: node,
      multiline: node.tr.length > 60 || node.tr.includes("\n"),
    });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child, i) => walk(child, `${path}.${i}`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) {
      walk(child, path ? `${path}.${key}` : key, out);
    }
  }
}

/** Sözlüğü gezip düzenlenebilir bütün metin alanlarını bölümlere ayırır. */
export function buildEditableSections(): EditableSection[] {
  return Object.entries(translations)
    .map(([key, value]) => {
      const fields: EditableField[] = [];
      walk(value, key, fields);
      return { key, label: SECTION_LABELS[key] ?? key, fields };
    })
    .filter((section) => section.fields.length > 0);
}

// ─── Bindirme ─────────────────────────────────────────────────────────────

export interface SiteContentRow {
  key: string;
  value: unknown;
}

export interface SiteTestimonialRow {
  id: string;
  quote_tr: string;
  quote_en: string;
  quote_fr: string;
  quote_ru: string;
  quote_es: string;
  quote_de: string;
  quote_ar: string;
  tags: unknown;
  order_index: number;
}

export interface SiteMomentRow {
  id: string;
  media_type: string;
  media_url: string;
  poster_url: string | null;
  tag_tr: string;
  tag_en: string;
  tag_fr: string;
  tag_ru: string;
  tag_es: string;
  tag_de: string;
  tag_ar: string;
  caption_tr: string;
  caption_en: string;
  caption_fr: string;
  caption_ru: string;
  caption_es: string;
  caption_de: string;
  caption_ar: string;
  order_index: number;
}

export interface SiteData {
  content: SiteContentRow[];
  testimonials: SiteTestimonialRow[];
  moments: SiteMomentRow[];
}

/** Satırdaki `<önek>_<dil>` sütunlarını tek bir metin demetine toplar. */
function localized(row: object, prefix: string): LocalizedValue {
  const record = row as Record<string, unknown>;
  // Bir dil boş bırakıldıysa Türkçe metne düş — ziyaretçi boş kutu görmesin.
  const fallback = String(record[`${prefix}_tr`] ?? "");
  return Object.fromEntries(
    CONTENT_LANGUAGES.map((code) => [code, String(record[`${prefix}_${code}`] ?? "") || fallback]),
  ) as LocalizedValue;
}

/**
 * Varsayılan sözlüğün üstüne veritabanındaki değişiklikleri bindirir.
 * Girdi hiçbir zaman değiştirilmez; her çağrı yeni bir kopya döndürür.
 */
export function applySiteData(data: SiteData | null): Translations {
  if (!data) return translations;

  const merged = clone(translations) as unknown as Record<string, unknown>;

  for (const row of data.content) {
    // Silinmiş ya da adı değişmiş bir yol kaydı kalmışsa sessizce atlanır.
    if (getAtPath(merged, row.key) === undefined) continue;
    setAtPath(merged, row.key, row.value);
  }

  if (data.testimonials.length > 0) {
    setAtPath(
      merged,
      "testimonials.items",
      data.testimonials.map((row) => ({
        quote: localized(row, "quote"),
        tags: Array.isArray(row.tags) ? row.tags : [],
      })),
    );
  }

  const photos = data.moments.filter((m) => m.media_type === "photo");
  const clips = data.moments.filter((m) => m.media_type === "video");

  if (photos.length > 0) {
    setAtPath(
      merged,
      "moments.shots",
      photos.map((row) => ({
        src: row.media_url,
        tag: localized(row, "tag"),
        caption: localized(row, "caption"),
      })),
    );
  }

  if (clips.length > 0) {
    setAtPath(
      merged,
      "moments.clips",
      clips.map((row) => ({
        src: row.media_url,
        poster: row.poster_url ?? "",
        caption: localized(row, "caption"),
      })),
    );
  }

  return merged as unknown as Translations;
}

export type { Language };
