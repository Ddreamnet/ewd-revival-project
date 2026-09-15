import { useEffect } from "react";

import { SITE_URL } from "@/lib/site";

/**
 * Sayfaya özel JSON-LD.
 *
 * `index.html` içindeki blok bütün yollar için sabit: kurum, site ve SSS.
 * Buradaki ise sayfa değiştikçe değişenler — kırıntı yolu ve blog yazısı
 * bilgisi. İkisi ayrı `<script>` etiketlerinde durur; arama motorları aynı
 * sayfadaki birden çok JSON-LD bloğunu birleştirerek okur.
 *
 * Kırıntı yolu, arama sonucunda başlığın üstündeki satırı
 * `englishwithdilara.com › Blog › Yazı` biçiminde gösterir; çıplak URL yerine
 * okunur bir yol çıkar.
 *
 * Etiket çalışma anında ekleniyor ama ön işleme (`scripts/prerender.mjs`)
 * sayfayı gerçek bir tarayıcıda çizip sonucu diske yazdığı için yayındaki
 * HTML'de hazır duruyor — JavaScript çalıştırmayan botlar da görüyor.
 */

const ETIKET_ID = "ewd-sayfa-jsonld";

export { SITE_URL };

export function useStructuredData(data: Record<string, unknown> | null) {
  useEffect(() => {
    if (!data) return;

    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = ETIKET_ID;
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);

    return () => el.remove();
  }, [data]);
}

interface Kirinti {
  ad: string;
  /** Köke göre yol; son kırıntı için boş bırakılabilir. */
  yol?: string;
}

/** `Ana sayfa › Blog › Yazı` zinciri. */
export function kirintiYolu(ogeler: Kirinti[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: ogeler.map((o, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: o.ad,
      ...(o.yol ? { item: SITE_URL + o.yol } : {}),
    })),
  };
}
