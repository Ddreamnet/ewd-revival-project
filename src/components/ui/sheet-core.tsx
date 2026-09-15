/**
 * Sheet çekirdeği — örtü yüzeylerinin ortak davranışı.
 *
 * EWD'de ortada açılan bir pencere vardı: masaüstünde de telefonda da
 * ekranın göbeğinde duran, kenarlarından tutulamayan, yalnızca ✕ ile
 * kapanan bir kutu. Yerine tek bir yüzey geldi:
 *
 *  · `lg` ve üstünde SAĞ ÇEKMECE — pencere yüksekliğince, kenardan bir kart
 *    kadar içeride. Örtü "açılır kutu" değil "ikinci kolon" okunur.
 *  · `lg` altında ALT KART — üstü yuvarlak, tutamaklı, güvenli alana duyarlı,
 *    HER YERİNDEN (ve üstündeki perdeden) aşağı çekilerek kapanır.
 *
 * Radix Dialog/AlertDialog altta kalır: odak tuzağı, `aria-modal`, Escape,
 * kaydırma kilidi ve portal elle yazıldığında hep yanlış çıkan parçalar.
 * Hareket ise `data-state`e bağlı düz CSS — Radix düğümü animasyon bitene
 * kadar söküp atmadığı için kapanış animasyonu gerçekten oynar.
 *
 * Bu dosya yalnızca davranışı taşır; yüzeyin kendisi `ui/dialog.tsx` ve
 * `ui/alert-dialog.tsx` içinde, biçimi `styles/sheet.css` içinde.
 */
import * as React from "react";

/* ------------------------------------------------------------------ */
/* Geometri                                                            */
/* ------------------------------------------------------------------ */

/** Bu genişliğin altında alt kart, üstünde sağ çekmece. */
export const NARROW_QUERY = "(max-width: 1023.98px)";

export const isNarrow = () => typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches;

/** Alt karta dönen bir yüzeyin kapalıyken durduğu yer. */
export const SHEET_CLOSED_TRANSFORM = "translate3d(0, 100%, 0)";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Sürükleyerek kapatma                                                */
/* ------------------------------------------------------------------ */

/** Hareketin ne olduğuna karar vermeden önce parmağın gitmesi gereken yol. */
const DRAG_DECIDE_PX = 4;
/** Bundan hızlı bir fiske, mesafeye bakılmaksızın kapatır (px/ms).
 *  0.4 native alt kartların (ve Vaul'un) yerleşik eşiği. */
const CLOSE_VELOCITY = 0.4;
/** Parmak yukarı dönüyorsa mesafe eşiği geçilse bile kapanmaz. */
const REVERSE_VELOCITY = -0.15;
/** Hız hareketin tamamından değil, son diliminden okunur. */
const VELOCITY_WINDOW_MS = 100;
/** Parmak bırakmadan önce duraksadıysa hız sıfırlanır. */
const VELOCITY_STALE_MS = 80;
/** Bu kadar yakın zamanda hâlâ kayan bir liste sürüklenmiyor, durduruluyordur. */
const SCROLL_SETTLE_MS = 200;
/** Giriş animasyonu oynarken sürükleme başlamaz. */
const OPEN_GRACE_MS = 400;
/** iOS'un alt kart eğrisi (Ionic → Vaul): hızlı çıkar, uzun oturur. */
const SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Parmağın kendi hareketi olan kontroller sürüklemeye kapılmaz. */
const NO_DRAG_SELECTOR =
  'select, input[type="range"], input[type="file"], input[type="color"], video, audio, [contenteditable="true"], [data-no-drag], [role="slider"]';

type DragScrim = React.RefObject<HTMLElement | null> | string;

interface DragState {
  x: number;
  y: number;
  dy: number;
  phase: "undecided" | "drag";
  onScrim: boolean;
  height: number;
  /** Parmağın altındaki kaydırıcı aşağı inmiş — aşağı çekmek onu geri kaydırır. */
  scrolledUp: boolean;
  /** Parmağın altındaki kaydırıcının altında daha var — yukarı çekmek onu kaydırır. */
  canScrollOn: boolean;
  samples: { y: number; t: number }[];
}

/** Dokunuşla kartın kökü arasındaki kaydırıcıların hangi yöne yeri var. */
function scrollRoom(target: Element, root: HTMLElement) {
  let up = false;
  let on = false;
  let el: Element | null = target;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 1) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") {
        if (el.scrollTop > 0) up = true;
        if (el.scrollTop + el.clientHeight < el.scrollHeight - 1) on = true;
      }
    }
    el = el.parentElement;
  }
  return { up, on };
}

function recentVelocity(samples: DragState["samples"], now: number) {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  // Parmak bırakmadan önce durdu: elindeki hız gitti.
  if (now - last.t > VELOCITY_STALE_MS) return 0;
  const first = samples[0];
  return (last.y - first.y) / Math.max(1, last.t - first.t);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Alt kartı sürükleyerek kapatma — HER YERİNDEN.
 *
 * İlk tasarım yalnızca tutamağı ve başlığı dinliyordu; kullanımda kart
 * "takılı" hissettiriyordu: başparmak kartın ortasına iner, aşağı çeker,
 * hiçbir şey olmaz. Native kartların kuralı — ve Vaul'un (shadcn drawer)
 * kuralı — şu:
 *
 *  · kartın üstünde ya da kararmış sayfanın üstünde başlayan dokunuş
 *    sürükleme olabilir;
 *  · 4px sonra sınıflanır: yana → bizim değil (çip şeridi kayıyor);
 *    parmağın altındaki bir kaydırıcı aşağı inmişken aşağı → kaydırma;
 *    tepedeyken aşağı → sürükleme; kaydıracak yer varken yukarı → kaydırma;
 *    kaydıracak yer yokken yukarı → sönümlü sürükleme (lastik bant);
 *  · 200ms önce hâlâ savrulan bir liste çekilmiyor, durduruluyordur — "atalet
 *    tepeye ulaşır ve kart uçup gider" kazası buradan çıkıyordu;
 *  · hareket bizim olduğu an her `touchmove` `preventDefault` edilir, böylece
 *    tarayıcı rakip bir kaydırma başlatamaz.
 *
 * Pointer değil touch olayları, bilerek: tarayıcı kaydırmaya karar verdiğinde
 * pointer akışını iptal eder ama dokunuşları vermeye devam eder — sınıflama
 * ise o karardan ÖNCE, ilk harekette olmak zorunda. Fare kullanıcısı için
 * tutamak üstünde ayrı bir pointer yolu var (aşağıda).
 *
 * Bırakma: 0.4px/ms'den hızlı bir fiske kapatır; kartın dörtte biri kadar
 * (48–140px) çekmek de kapatır — parmak geri yukarı dönmüyorsa. Kapanış
 * hareketi parmağın bıraktığı yerden, kalan yola ve bırakma hızına göre
 * hesaplanan bir sürede devam eder; hareket hâlindeki bir kartı önce
 * frenleyip sonra yeniden hızlandıran sabit bir 240ms değil.
 *
 * Kart hareket ederken perde de açılır: alfası `--scrim-p`, burada kare
 * kare sürülür.
 */
export function useDragToDismiss(
  contentRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  options: {
    /** Yüzey açık mı. Radix'in söküp taktığı içerik bunu vermeyebilir. */
    open?: boolean;
    /**
     * Radix'in SÖKMEDİĞİ paneller için (yapısal yan panel): kapalıyken
     * durduğu transform. Bırakıp kapatma önce düğümü oraya kaydırır, `open`
     * ancak ondan sonra sahibine bırakılır — sürükleme ve çıkış tek hareket
     * okunur.
     */
    closedTransform?: string;
    /** Arkadaki kararmış sayfa: dokunmak kapatır, aşağı çekmek kartı çeker. */
    scrim?: DragScrim;
    /** Sürükleme tümden kapalı (tam ekran görüntüleyici gibi). */
    disabled?: boolean;
  } = {},
) {
  const { open = true, closedTransform, scrim, disabled } = options;
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  React.useEffect(() => {
    if (!open || disabled) return;
    const node = contentRef.current;
    if (!node || !isNarrow()) return;
    const scrimEl = typeof scrim === "string" ? document.querySelector<HTMLElement>(scrim) : (scrim?.current ?? null);
    const openedAt = performance.now();
    let lastScrollAt = 0;
    let s: DragState | null = null;

    /* -- Çizim: transform yazımları kareye toplanır ------------------ */
    // 120Hz cihazlarda `touchmove` kare başına birden çok kez gelebiliyor;
    // her birinde stil yazmak aynı karede birden çok layout tetikler.
    // Son değeri bir rAF'ta yazmak hareketi gözle görülür biçimde
    // düzleştiriyor.
    let raf = 0;
    let pendingDy: number | null = null;
    const paint = () => {
      raf = 0;
      if (pendingDy === null) return;
      const dy = pendingDy;
      pendingDy = null;
      node!.style.transform = `translate3d(0, ${dy}px, 0)`;
      if (scrimEl && s) scrimEl.style.setProperty("--scrim-p", String(clamp(1 - Math.max(0, dy) / s.height, 0, 1)));
    };
    const draw = (dy: number) => {
      pendingDy = dy;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const flush = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      paint();
    };

    const onScroll = () => {
      lastScrollAt = performance.now();
    };

    function onStart(e: TouchEvent) {
      if (s || e.touches.length !== 1) return;
      if (node!.dataset.state === "closed") return;
      if (performance.now() - openedAt < OPEN_GRACE_MS) return;
      const target = e.target as Element | null;
      if (!target) return;
      const onScrim = !!scrimEl && scrimEl.contains(target);
      if (!onScrim) {
        if (!node!.contains(target)) return;
        // Yalnızca kendi dokunma hareketi olan bir kontrol parmağı elinde
        // tutar. Düz input ve textarea TUTMAZ — bir form kartında ekranın
        // çoğunu kaplarlar ve yalnızca alanlar arasındaki boşluktan kapanan
        // bir kart, kapanmayan bir kart okunur. Yarım dolu bir formu
        // kaybetmek yine de kartın dörtte birini çekmeyi gerektiriyor.
        if (target.closest(NO_DRAG_SELECTOR)) return;
        if (window.getSelection()?.toString()) return;
      }
      const t = e.touches[0];
      const room = onScrim ? { up: false, on: false } : scrollRoom(target, node!);
      s = {
        x: t.clientX,
        y: t.clientY,
        dy: 0,
        phase: "undecided",
        onScrim,
        height: node!.getBoundingClientRect().height,
        scrolledUp: room.up,
        canScrollOn: room.on,
        samples: [],
      };
    }

    function claim() {
      s!.phase = "drag";
      // Giriş keyframe'inin dolgusunu öldürür: animasyon değeri inline stili
      // ezer, yoksa kart parmağı hiç izlemez.
      node!.dataset.dragged = "true";
      node!.style.transition = "none";
      if (scrimEl) scrimEl.style.transition = "none";
    }

    function onMove(e: TouchEvent) {
      if (!s) return;
      // İkinci parmak indi (yakınlaştırma, iki parmak kaydırma): hareket
      // artık bizim değil, kartı yerine bırak.
      if (e.touches.length !== 1) {
        const st = s;
        s = null;
        if (st.phase === "drag") springBack();
        return;
      }
      const t = e.touches[0];
      const raw = t.clientY - s.y;
      const dx = t.clientX - s.x;
      if (s.phase === "undecided") {
        if (Math.abs(raw) < DRAG_DECIDE_PX && Math.abs(dx) < DRAG_DECIDE_PX) return;
        if (Math.abs(dx) > Math.abs(raw)) {
          s = null;
          return;
        }
        if (raw > 0) {
          if (s.scrolledUp || performance.now() - lastScrollAt < SCROLL_SETTLE_MS) {
            s = null;
            return;
          }
        } else if (s.canScrollOn) {
          s = null;
          return;
        }
        claim();
      }
      if (e.cancelable) e.preventDefault();
      // Yukarı sürükleme lastik bant: dinlenme yüksekliğindeki bir kartın
      // gidecek yeri yok, sert duruş duvara çarpmak gibi hissettiriyor.
      const dy = raw < 0 ? -Math.sqrt(-raw) * 1.5 : raw;
      s.dy = dy;
      const now = performance.now();
      s.samples.push({ y: t.clientY, t: now });
      while (s.samples.length > 2 && now - s.samples[1].t > VELOCITY_WINDOW_MS) s.samples.shift();
      draw(dy);
    }

    function springBack() {
      flush();
      // Geçiş sınıfın üstünde; inline bastırmayı kaldırmak bu tek dönüş
      // yolculuğu için onu çalıştırır. `data-dragged` kalır: giriş keyframe'i
      // geri gelip transform'u çivilememeli.
      node!.style.transition = "";
      node!.style.transform = "";
      if (scrimEl) {
        scrimEl.style.transition = "";
        scrimEl.style.removeProperty("--scrim-p");
      }
    }

    function close(dy: number, velocity: number, height: number) {
      flush();
      const remaining = Math.max(0, height - dy);
      if (closedTransform) {
        // Kaydırmayı kendimiz bitirir, `open`ı ancak sonra sahibine bırakırız.
        const dur = Math.round(clamp(remaining / Math.max(velocity, 1.4), 150, 240));
        node!.style.transition = `transform ${dur}ms ${SHEET_EASE}`;
        node!.style.transform = closedTransform;
        const done = () => {
          node!.style.transform = "";
          node!.style.transition = "";
          node!.removeEventListener("transitionend", done);
        };
        node!.addEventListener("transitionend", done);
        window.setTimeout(done, dur + 80);
      } else {
        // Radix `data-state`i çevirir, kapanış keyframe'i `--sheet-drag`den
        // devralır. Inline transform o ana kadar yerinde durur, yani kartın
        // önce tepeye zıpladığı bir kare olmaz.
        const dur = Math.round(clamp(remaining / Math.max(velocity, 1.4), 150, 300));
        node!.style.setProperty("--sheet-drag", `${Math.max(0, dy)}px`);
        node!.style.setProperty("--sheet-out-dur", `${dur}ms`);
      }
      if (scrimEl) scrimEl.style.transition = "";
      onCloseRef.current();
    }

    function onEnd(e: TouchEvent) {
      if (!s) return;
      const st = s;
      s = null;
      if (st.phase === "undecided") {
        // Kararmış sayfaya dokunuş: kapat. (Yalnızca gerçek bir kalkış —
        // iptal edilmiş dokunuş, parmağı tarayıcının alması demek.)
        if (st.onScrim && e.type === "touchend") {
          if (e.cancelable) e.preventDefault();
          close(0, 0, st.height);
        }
        return;
      }
      // Parmağın altında kalan neyse ona sahte tıklama gitmesin.
      if (e.cancelable) e.preventDefault();
      const velocity = recentVelocity(st.samples, performance.now());
      const threshold = clamp(st.height * 0.25, 48, 140);
      const flick = velocity > CLOSE_VELOCITY;
      const pulled = st.dy > threshold && velocity > REVERSE_VELOCITY;
      if (e.type === "touchend" && st.dy > 0 && (flick || pulled)) close(st.dy, velocity, st.height);
      else springBack();
    }

    /* -- Fare: yalnızca tutamak ve başlık şeridi --------------------- */
    // Dar pencerede masaüstü tarayıcı da alt kart geometrisine düşer.
    // Dokunma olayı gelmeyen bir fare için kartın tamamı sürükleme yüzeyi
    // OLAMAZ (metin seçmek, buton sürüklemek meşru işler), ama tutamak ve
    // başlık şeridi doğal kulplar.
    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0 || s) return;
      const target = e.target as Element | null;
      if (!target?.closest("[data-sheet-grab]")) return;
      if (target.closest("button, a, input, textarea, select")) return;
      e.preventDefault();
      const height = node!.getBoundingClientRect().height;
      const startY = e.clientY;
      const samples: DragState["samples"] = [];
      node!.dataset.dragged = "true";
      node!.style.transition = "none";
      if (scrimEl) scrimEl.style.transition = "none";
      let dy = 0;

      const move = (ev: MouseEvent) => {
        const raw = ev.clientY - startY;
        dy = raw < 0 ? -Math.sqrt(-raw) * 1.5 : raw;
        const now = performance.now();
        samples.push({ y: ev.clientY, t: now });
        while (samples.length > 2 && now - samples[1].t > VELOCITY_WINDOW_MS) samples.shift();
        pendingDy = dy;
        if (!raf) raf = requestAnimationFrame(() => {
          raf = 0;
          const v = pendingDy;
          pendingDy = null;
          if (v === null) return;
          node!.style.transform = `translate3d(0, ${v}px, 0)`;
          if (scrimEl) scrimEl.style.setProperty("--scrim-p", String(clamp(1 - Math.max(0, v) / height, 0, 1)));
        });
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        const velocity = recentVelocity(samples, performance.now());
        const threshold = clamp(height * 0.25, 48, 140);
        if (dy > 0 && (velocity > CLOSE_VELOCITY || (dy > threshold && velocity > REVERSE_VELOCITY))) close(dy, velocity, height);
        else springBack();
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }

    const surfaces = scrimEl ? [node, scrimEl] : [node];
    node.addEventListener("scroll", onScroll, { capture: true, passive: true });
    node.addEventListener("mousedown", onMouseDown);
    for (const el of surfaces) {
      el.addEventListener("touchstart", onStart, { passive: true });
      el.addEventListener("touchmove", onMove, { passive: false });
      el.addEventListener("touchend", onEnd, { passive: false });
      el.addEventListener("touchcancel", onEnd, { passive: false });
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      node.removeEventListener("scroll", onScroll, { capture: true });
      node.removeEventListener("mousedown", onMouseDown);
      for (const el of surfaces) {
        el.removeEventListener("touchstart", onStart);
        el.removeEventListener("touchmove", onMove);
        el.removeEventListener("touchend", onEnd);
        el.removeEventListener("touchcancel", onEnd);
      }
      s = null;
    };
  }, [open, disabled, contentRef, closedTransform, scrim]);
}

/* ------------------------------------------------------------------ */
/* Yükseklik canlandırması                                             */
/* ------------------------------------------------------------------ */

/**
 * İçeriği boy değiştirdiğinde kartın yüksekliğini canlandırır — listeden
 * forma geçen bir kart zıplamaz, büyür. İçerik düğümünde FLIP:
 * ResizeObserver yerleşimden sonra, çizimden önce ateşlenir; eski yükseklik
 * geri konur ve arada hiçbir şey çizilmeden yenisine geçilir.
 * Yalnızca telefonda; masaüstü çekmecesi zaten tam boy durur.
 */
export function useAnimatedHeight(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  React.useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || !isNarrow() || prefersReducedMotion()) return;
    let last = node.offsetHeight;
    let animating = false;
    const ro = new ResizeObserver(() => {
      if (animating || node.style.height || node.dataset.dragged) return;
      const next = node.offsetHeight;
      if (Math.abs(next - last) < 2) {
        last = next;
        return;
      }
      const from = last;
      last = next;
      animating = true;
      node.style.height = `${from}px`;
      void node.offsetHeight;
      node.style.height = `${next}px`;
      const done = (e?: TransitionEvent) => {
        if (e && e.propertyName !== "height") return;
        node.style.height = "";
        animating = false;
        node.removeEventListener("transitionend", done);
      };
      node.addEventListener("transitionend", done);
      window.setTimeout(() => done(), 420);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref, enabled]);
}

/* ------------------------------------------------------------------ */
/* Mount'u bildiren ref                                                */
/* ------------------------------------------------------------------ */

/**
 * Düğümün orada olup olmadığını da bildiren bir ref. Bu bileşen kart KAPALI
 * iken de render olur (Radix'in Portal'ı DOM'u açılana kadar dışarıda tutar);
 * yalnızca mount'a bağlı bir effect bir kez null ref'e karşı çalışır ve bir
 * daha çalışmazdı. Aşağıdaki kancalar içerik düğümü indiğinde yeniden koşar.
 */
export function useMountedRef<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const setRef = React.useCallback((el: T | null) => {
    ref.current = el;
    setMounted(!!el);
  }, []);
  return [ref, setRef, mounted] as const;
}

/* ------------------------------------------------------------------ */
/* Klavye payı                                                         */
/* ------------------------------------------------------------------ */

/**
 * Ekran klavyesi açılınca alt kartı onun üstüne taşır.
 *
 * Alt kart `position: fixed; bottom: 0` — yani yerleşim görünümüne (layout
 * viewport) yapışık. Klavye görsel görünümü (visual viewport) kısaltır ama
 * yerleşim görünümünü değiştirmez, dolayısıyla kartın alt yarısı ve
 * çoğunlukla tam da yazılan alan klavyenin ALTINDA kalır. `visualViewport`
 * farkı `--ewd-sheet-kb` olarak yazılır; CSS kartı o kadar yukarı alır.
 *
 * Aynı anda birden çok kart açık olabileceği için sayaçlı: son kart
 * kapanınca değişken temizlenir.
 */
let kbUsers = 0;
let kbDetach: (() => void) | null = null;

export function useKeyboardInset(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    kbUsers += 1;
    if (kbUsers === 1) {
      const vv = window.visualViewport;
      if (vv) {
        const sync = () => {
          const gap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
          // 80px altındaki farklar klavye değil: adres çubuğunun daralması,
          // yüzen bir araç çubuğu. Kartı onlar için oynatmak titreme olur.
          document.documentElement.style.setProperty("--ewd-sheet-kb", gap > 80 ? `${Math.round(gap)}px` : "0px");
        };
        sync();
        vv.addEventListener("resize", sync);
        vv.addEventListener("scroll", sync);
        kbDetach = () => {
          vv.removeEventListener("resize", sync);
          vv.removeEventListener("scroll", sync);
          document.documentElement.style.removeProperty("--ewd-sheet-kb");
        };
      }
    }
    return () => {
      kbUsers -= 1;
      if (kbUsers === 0) {
        kbDetach?.();
        kbDetach = null;
      }
    };
  }, [active]);
}

/* ------------------------------------------------------------------ */
/* Açık kartlar yığını — Android geri tuşu                             */
/* ------------------------------------------------------------------ */

/**
 * Açık örtülerin yığını.
 *
 * Radix Escape'i kendi hallediyor ama Android'in donanım/gesture geri tuşunu
 * bilmiyor: kart açıkken geriye basmak kartı kapatmak yerine sayfadan
 * çıkıyordu. `useAndroidBackButton` önce buraya sorar (bkz.
 * hooks/usePanelPlatform.ts).
 */
const openSheets: Array<() => void> = [];

export function useSheetStack(active: boolean, dismiss: () => void) {
  const ref = React.useRef(dismiss);
  React.useEffect(() => {
    ref.current = dismiss;
  });
  React.useEffect(() => {
    if (!active) return;
    const entry = () => ref.current();
    openSheets.push(entry);
    return () => {
      const i = openSheets.indexOf(entry);
      if (i >= 0) openSheets.splice(i, 1);
    };
  }, [active]);
}

/** En üstteki açık örtüyü kapatır. Açık örtü yoksa false döner. */
export function closeTopSheet(): boolean {
  const top = openSheets[openSheets.length - 1];
  if (!top) return false;
  top();
  return true;
}

/** Şu an açık en az bir örtü var mı. */
export const hasOpenSheet = () => openSheets.length > 0;
