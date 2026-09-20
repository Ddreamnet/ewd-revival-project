/**
 * Ekran klavyesinin kapladığı yer — tek kaynak.
 *
 * Panelde klavye açılınca "sayfa deliriyordu": aynı anda üç mekanizma
 * yüksekliği değiştiriyor —
 *   · index.html'deki `interactive-widget=resizes-content` (tarayıcı yerleşim
 *     görünümünü kısaltır; Android Chrome ve modern web),
 *   · Capacitor'ın `Keyboard.resize: "body"` ayarı (gövdeyi kısaltır; iOS
 *     WKWebView'da `interactive-widget` yok, orada bu çalışır),
 *   · ve `position: fixed` öğeler (alt sekme çubuğu, alttan çıkan kart)
 *     hiçbirinden etkilenmeyip klavyenin ALTINDA kalır.
 *
 * Buradaki ölçüm kendi kendini düzeltir: görsel görünüm ile yerleşim görünümü
 * arasındaki fark alınır. Tarayıcı yerleşimi zaten kısalttıysa fark ~0 çıkar
 * ve hiçbir şey yapılmaz; kısaltmadıysa fark klavyenin boyudur. Yani hangi
 * platformda hangi mekanizmanın devrede olduğunu bilmeye gerek kalmıyor.
 *
 * Yazdıkları:
 *   --ewd-kb        : klavyenin yüksekliği (yoksa 0px)
 *   <html data-kb>  : "open" — CSS bununla alt çubuğu gizler
 */
import { useEffect } from "react";

/** Bu eşiğin altındaki farklar klavye değil: adres çubuğunun daralması,
 *  yüzen bir araç çubuğu. Onlar için yerleşimi oynatmak titreme olur. */
const KEYBOARD_MIN_PX = 80;

let users = 0;
let detach: (() => void) | null = null;

function attach() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (!vv) return null;

  let raf = 0;
  // "0px" ile başlar: klavye kapalıyken ilk ölçüm hiçbir şey yazmaz. Boş
  // başladığında ilk kullanan (panel dışında: açılan ilk kart) <html>'e
  // `--ewd-kb: 0px` yazıp bütün sayfanın stilini boşuna geçersiz kılıyordu;
  // her kullanım yerinde `var(--ewd-kb, 0px)` yedeği zaten var.
  let last = "0px";
  const apply = () => {
    raf = 0;
    const gap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    const open = gap > KEYBOARD_MIN_PX;
    const value = open ? `${Math.round(gap)}px` : "0px";
    // Yalnızca değişince yaz: <html> üzerindeki bir değişken TÜM sayfanın
    // stilini geçersiz kılıyor. visualViewport kaydırmada da haber veriyor;
    // her seferinde yazmak, klavye açıkken kaydırırken sayfayı ağırlaştırıyordu.
    if (value === last) return;
    last = value;
    root.style.setProperty("--ewd-kb", value);
    if (open) root.setAttribute("data-kb", "open");
    else root.removeAttribute("data-kb");
  };
  // Klavye açılırken visualViewport birkaç kare boyunca art arda haber
  // veriyor; her birinde stil yazmak gözle görülür bir titreme yapıyordu.
  const sync = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };

  apply();
  vv.addEventListener("resize", sync);
  vv.addEventListener("scroll", sync);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    vv.removeEventListener("resize", sync);
    vv.removeEventListener("scroll", sync);
    root.style.removeProperty("--ewd-kb");
    root.removeAttribute("data-kb");
  };
}

/**
 * Sayaçlı: panel kabuğu her zaman, açık kartlar da ayrıca çağırır; son
 * kullanan gidince değişkenler temizlenir.
 */
export function useKeyboardInset(active = true) {
  useEffect(() => {
    if (!active) return;
    users += 1;
    if (users === 1) detach = attach();
    return () => {
      users -= 1;
      if (users === 0) {
        detach?.();
        detach = null;
      }
    };
  }, [active]);
}
