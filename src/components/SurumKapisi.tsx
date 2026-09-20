/**
 * Sürüm kapısının yüzü — yalnızca uygulamada (native) bir şey çizer.
 *
 *  · "zorunlu":  bütün ekranı kaplayan, kapatılamayan "Güncelle" ekranı.
 *  · "onerilen": her açılışta çıkan, kapatılabilir "yeni sürüm çıktı" kartı.
 *
 * Metinler veliler düşünülerek yazıldı: ne olduğu, ne yapacakları ve en çok
 * çekindikleri şeyin — yeniden giriş yapmanın — gerekmeyeceği açıkça söyleniyor.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppResume } from "@/hooks/usePanelPlatform";
import { magazayiAc, surumDurumu, surumUyarisi, type SurumDurumu } from "@/lib/appRelease";
import { isNative } from "@/lib/platform";

/** Arka plandan dönüşte öneri kartını yeniden göstermeden önce beklenecek süre. */
const YENIDEN_GOSTERME_MS = 12 * 60 * 60 * 1000;

export function SurumKapisi() {
  const [durum, setDurum] = useState<SurumDurumu>("guncel");
  const [kartAcik, setKartAcik] = useState(false);
  const sonGosterim = useRef(0);

  const yokla = useCallback(async () => {
    const yeni = await surumDurumu();
    setDurum(yeni);
    if (yeni === "onerilen" && Date.now() - sonGosterim.current >= YENIDEN_GOSTERME_MS) {
      sonGosterim.current = Date.now();
      // Bayrak burada, çizimi beklemeden kalkıyor: aynı sorguyu bekleyen
      // bildirim hatırlatması sıradaki mikro görevde bakacak.
      surumUyarisi.ayarla(true);
      setKartAcik(true);
    }
    if (yeni === "zorunlu") surumUyarisi.ayarla(true);
    if (yeni === "guncel") setKartAcik(false);
  }, []);

  useEffect(() => {
    if (isNative) yokla();
  }, [yokla]);

  useAppResume(() => {
    if (isNative) yokla();
  });

  const gorunur = durum === "zorunlu" || (durum === "onerilen" && kartAcik);
  useEffect(() => {
    surumUyarisi.ayarla(gorunur);
    return () => surumUyarisi.ayarla(false);
  }, [gorunur]);

  if (!isNative || durum === "guncel") return null;

  if (durum === "zorunlu") {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="surum-kapisi-baslik"
        aria-describedby="surum-kapisi-metin"
        className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-5 bg-background px-7 text-center text-foreground"
        style={{
          paddingTop: "var(--safe-area-top)",
          paddingBottom: "var(--safe-area-bottom)",
        }}
      >
        <img src="/uploads/logo.webp" alt="" aria-hidden="true" className="h-28 w-auto" />
        <h1 id="surum-kapisi-baslik" className="text-[24px] font-black tracking-[-0.01em]">
          Yeni sürüm hazır
        </h1>
        <p id="surum-kapisi-metin" className="max-w-[320px] text-[16px] font-medium leading-relaxed text-muted-foreground">
          Uygulamayı kullanmaya devam etmek için güncellemeniz gerekiyor. Bir dakikadan kısa sürer; hesabınız
          açık kalır, yeniden giriş yapmazsınız.
        </p>
        <button type="button" onClick={magazayiAc} className="ewd-btn ewd-btn--purple mt-1 w-full max-w-[320px]">
          Güncelle
        </button>
      </div>
    );
  }

  return (
    <Dialog open={kartAcik} onOpenChange={setKartAcik}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Yeni sürüm çıktı</DialogTitle>
          <DialogDescription>Uygulamanın daha yeni bir sürümü var.</DialogDescription>
        </DialogHeader>

        <p className="text-[15px] leading-relaxed">
          Güncellemek bir dakikadan kısa sürer; hesabınız açık kalır, yeniden giriş yapmazsınız.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setKartAcik(false)}>
            Sonra
          </Button>
          <Button onClick={magazayiAc}>Güncelle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
