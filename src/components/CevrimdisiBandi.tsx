/**
 * Bağlantı kesilince ekranın üstünde beliren küçük bant.
 *
 * Bağlantı yokken işlemler "Sunucuya ulaşılamadı" bildirimiyle tek tek
 * düşüyordu; kullanıcı sorunun uygulamada mı kendi internetinde mi olduğunu
 * anlayamıyordu. Uygulamalar bunu baştan söyler. Bant yalnızca bilgi verir:
 * ekran kullanılmaya devam eder (son veri önbellekten çizili), bağlantı
 * gelince kısa bir "geri geldi" gösterip kaybolur.
 */
import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

const GERI_GELDI_MS = 2500;

export function CevrimdisiBandi() {
  const [cevrimdisi, setCevrimdisi] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const [geriGeldi, setGeriGeldi] = useState(false);
  const kesikti = useRef(cevrimdisi);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const kesildi = () => {
      clearTimeout(timer);
      kesikti.current = true;
      setGeriGeldi(false);
      setCevrimdisi(true);
    };
    const geldi = () => {
      setCevrimdisi(false);
      if (!kesikti.current) return;
      kesikti.current = false;
      setGeriGeldi(true);
      timer = setTimeout(() => setGeriGeldi(false), GERI_GELDI_MS);
    };

    window.addEventListener("offline", kesildi);
    window.addEventListener("online", geldi);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("offline", kesildi);
      window.removeEventListener("online", geldi);
    };
  }, []);

  if (!cevrimdisi && !geriGeldi) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[900] flex justify-center px-4"
      style={{ top: "calc(var(--safe-area-top) + 8px)" }}
    >
      <span
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white shadow-lg"
        style={{ background: cevrimdisi ? "#3B2A55" : "#1F7A4D" }}
      >
        {cevrimdisi ? (
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Wifi className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {cevrimdisi ? "İnternet bağlantısı yok" : "Bağlantı geri geldi"}
      </span>
    </div>
  );
}
