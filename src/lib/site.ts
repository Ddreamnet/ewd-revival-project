/**
 * Sitenin yayındaki adresi.
 *
 * Canonical, `og:url` ve paylaşım görselleri bir zamanlar
 * `window.location.origin` üzerinden kuruluyordu. İki yerde yanlış sonuç
 * veriyordu:
 *   · Ön işleme sırasında sayfa yerel sunucuda açılıyor — üretilen HTML'e
 *     `http://127.0.0.1:.../blog/...` gibi bir canonical gömülüyordu.
 *   · Capacitor kabuğunda origin `capacitor://localhost` oluyor.
 *
 * Canonical zaten "bu içeriğin asıl adresi" demek; hangi kopyadan bakıldığına
 * göre değişmemeli. Bu yüzden sabit.
 */
export const SITE_URL = "https://englishwithdilara.com";

/** Mağaza sayfaları — footer'daki indirme bağlantıları ve uygulamadaki "Güncelle" düğmesi. */
export const APP_STORE_URL = "https://apps.apple.com/tr/app/english-with-dilara/id6760347669?l=tr";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.englishwithdilara.app";

/** Köke göre yolu ya da hazır mutlak adresi tam URL'e çevirir. */
export function tamUrl(yol: string) {
  return new URL(yol, SITE_URL).toString();
}

/**
 * HTML gövdeden arama sonucuna uygun bir açıklama çıkarır.
 *
 * Blog yazılarının `excerpt` alanı boş; açıklama yazılmadığında hepsi arama
 * sonucunda sitenin genel tanıtım cümlesiyle çıkıyordu — altı yazı, altı aynı
 * satır. Özet varsa o kullanılır, yoksa gövdenin ilk cümleleri.
 */
export function ozetCikar(html: string | null | undefined, sinir = 155): string | undefined {
  if (!html) return undefined;
  const duz = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!duz) return undefined;
  if (duz.length <= sinir) return duz;
  // Kelimenin ortasından kesme.
  const kirp = duz.slice(0, sinir);
  const bosluk = kirp.lastIndexOf(" ");
  return (bosluk > sinir * 0.6 ? kirp.slice(0, bosluk) : kirp).replace(/[.,;:\s]+$/, "") + "…";
}
