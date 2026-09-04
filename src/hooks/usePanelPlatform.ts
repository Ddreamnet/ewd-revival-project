/**
 * Panelin platforma / zamana bağlı küçük yardımcıları.
 * Tek dosyada toplandı: hepsi panel kabuğunun ihtiyaç duyduğu davranışlar.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isAndroid, isNative } from "@/lib/platform";

/**
 * Android donanım/gesture geri tuşunu ekrandaki `‹` butonuyla aynı yere bağlar.
 *
 * `handler` true dönerse olay tüketilmiş sayılır. Kök ekranda false dönmek
 * uygulamayı arka plana atar — Android'in beklenen davranışı.
 */
export function useAndroidBackButton(handler: () => boolean) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!isAndroid) return;
    let remove: (() => void) | undefined;
    let cancelled = false;

    import("@capacitor/app")
      .then(({ App }) =>
        App.addListener("backButton", () => {
          const consumed = handlerRef.current();
          if (!consumed) App.minimizeApp();
        }),
      )
      .then((h) => {
        if (cancelled) h.remove();
        else remove = () => h.remove();
      })
      .catch(() => {
        /* @capacitor/app yoksa sistem varsayılanı çalışır */
      });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
}

/**
 * Sekme başına kaydırma konumunu hatırlar.
 * Geri dönüldüğünde liste baştan değil, bırakıldığı yerden görünür.
 */
const scrollMemory = new Map<string, number>();

export function useScrollMemory(key: string, enabled = true) {
  const location = useLocation();
  const fullKey = `${key}:${location.pathname}`;

  useLayoutEffect(() => {
    if (!enabled) return;
    const saved = scrollMemory.get(fullKey);
    if (saved !== undefined) {
      window.scrollTo(0, saved);
    }
    const onScroll = () => scrollMemory.set(fullKey, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollMemory.set(fullKey, window.scrollY);
      window.removeEventListener("scroll", onScroll);
    };
  }, [fullKey, enabled]);
}

/**
 * Dakika başında tetiklenen saat.
 *
 * "42 dk sonra" gibi canlı değerler için: saniyede bir değil, dakika
 * sınırında bir kez günceller ve yalnızca onu kullanan düğümü yeniden
 * çizer. Uygulama arka plandan dönünce de tazelenir.
 */
export function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const msToNextMinute = 60_000 - (Date.now() % 60_000);
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, msToNextMinute + 50);
    };
    schedule();

    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return now;
}

/**
 * Uygulama ön plana geldiğinde çağrılır (native) / sekme görünür olunca (web).
 * Panel verisini sessizce tazelemek için.
 */
export function useAppResume(onResume: () => void) {
  const ref = useRef(onResume);
  ref.current = onResume;

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    document.addEventListener("visibilitychange", onVisible);

    let remove: (() => void) | undefined;
    let cancelled = false;
    if (isNative) {
      import("@capacitor/app")
        .then(({ App }) =>
          App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) ref.current();
          }),
        )
        .then((h) => {
          if (cancelled) h.remove();
          else remove = () => h.remove();
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      remove?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}

/**
 * Bir yolun ön yüklenmesi — sekmeye dokunmadan önce parçayı indirir.
 * `React.lazy` ile bölünmüş ekranlarda geçişte indirme beklemesi olmasın diye.
 */
export function usePrefetcher(loaders: Record<string, () => Promise<unknown>>) {
  const done = useRef(new Set<string>());
  const loadersRef = useRef(loaders);
  loadersRef.current = loaders;

  // Boşta kalan ilk anda hepsini indir; mobilde sekme geçişi anlık olsun.
  useEffect(() => {
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 800);

    idle(() => {
      Object.keys(loadersRef.current).forEach((key) => {
        if (done.current.has(key)) return;
        done.current.add(key);
        loadersRef.current[key]?.().catch(() => done.current.delete(key));
      });
    });
  }, []);

  return (key: string) => {
    if (done.current.has(key)) return;
    done.current.add(key);
    loadersRef.current[key]?.().catch(() => done.current.delete(key));
  };
}

/** Geri gidilecek bir geçmiş yoksa verilen yola düşer. */
export function useSafeBack(fallback: string) {
  const navigate = useNavigate();
  return () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
