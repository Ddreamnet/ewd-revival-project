import { useEffect } from "react";

/**
 * Sayfa başlığı ve paylaşım etiketleri.
 *
 * Site tek sayfalık (SPA) ve sunucu tarafında ön işleme yok; `index.html`'deki
 * tek bir `<title>` bütün yollar için geçerliydi. Sonuç: WhatsApp'ta ya da
 * arama sonucunda paylaşılan her blog yazısı "English with Dilara" olarak,
 * görselsiz görünüyordu.
 *
 * Bağlantı önizlemesi üreten botların çoğu JavaScript çalıştırmaz; bu hook
 * onları tam olarak çözmez ama JS çalıştıran botlar (Google dâhil), tarayıcı
 * sekmesi, tarayıcı geçmişi ve ekran okuyucular için doğru başlığı verir.
 * Tam çözüm için ön işleme (prerender) gerekir — README'ye not düşüldü.
 */

interface Meta {
  title: string;
  description?: string;
  /** Mutlak ya da köke göre yol; paylaşım görseli. */
  image?: string;
  /** "article" — blog yazıları için. */
  type?: "website" | "article";
  /** ISO tarih; yalnızca `type: "article"` için yazılır. */
  publishedTime?: string;
  /** ISO tarih; yalnızca `type: "article"` için yazılır. */
  modifiedTime?: string;
}

const SITE_ADI = "English with Dilara";
const VARSAYILAN_GORSEL = "/uploads/og-cover.jpg";

/** `og:locale` Facebook'un dil_ÜLKE biçimini ister; `<html lang>` yalnızca dili taşıyor. */
const OG_LOCALE: Record<string, string> = {
  tr: "tr_TR",
  en: "en_US",
  fr: "fr_FR",
  ru: "ru_RU",
  es: "es_ES",
  de: "de_DE",
  ar: "ar_AR",
};

/** `<meta>` etiketini bul ya da oluştur, içeriğini yaz. */
function metaYaz(anahtar: "property" | "name", ad: string, icerik: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${anahtar}="${ad}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(anahtar, ad);
    document.head.appendChild(el);
  }
  el.setAttribute("content", icerik);
}

/** Artık geçerli olmayan etiketi kaldır. */
function metaSil(ad: string) {
  document.head.querySelector(`meta[property="${ad}"]`)?.remove();
}

function canonicalYaz(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = url;
}

export function useDocumentMeta({
  title,
  description,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
}: Meta) {
  useEffect(() => {
    const oncekiBaslik = document.title;
    const tamBaslik = title === SITE_ADI ? title : `${title} · ${SITE_ADI}`;
    document.title = tamBaslik;

    const url = window.location.origin + window.location.pathname;
    const gorsel = new URL(image || VARSAYILAN_GORSEL, window.location.origin).toString();

    metaYaz("property", "og:title", tamBaslik);
    metaYaz("property", "og:type", type);
    metaYaz("property", "og:url", url);
    metaYaz("property", "og:image", gorsel);
    metaYaz("property", "og:site_name", SITE_ADI);
    // Dil, `LanguageProvider` tarafından `<html lang>`e yazılıyor; paylaşım
    // kartı da aynı dili söylesin.
    metaYaz("property", "og:locale", OG_LOCALE[document.documentElement.lang] ?? "tr_TR");
    metaYaz("name", "twitter:card", "summary_large_image");
    metaYaz("name", "twitter:title", tamBaslik);
    metaYaz("name", "twitter:image", gorsel);
    canonicalYaz(url);

    // Yazının tarihi yalnızca yazı sayfasında anlamlı; ana sayfaya geçildiğinde
    // önceki yazının tarihi etiketlerde kalmasın.
    if (type === "article" && publishedTime) metaYaz("property", "article:published_time", publishedTime);
    else metaSil("article:published_time");
    if (type === "article" && modifiedTime) metaYaz("property", "article:modified_time", modifiedTime);
    else metaSil("article:modified_time");

    if (description) {
      metaYaz("name", "description", description);
      metaYaz("property", "og:description", description);
      metaYaz("name", "twitter:description", description);
    }

    return () => {
      document.title = oncekiBaslik;
    };
  }, [title, description, image, type, publishedTime, modifiedTime]);
}
