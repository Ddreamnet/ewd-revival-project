/**
 * "Bildirimler kapalı" hatırlatması — yalnızca uygulamada (native).
 *
 * Bildirim izni bir kez reddedilince işletim sistemi izin penceresini bir daha
 * göstermiyor (iOS ilk retten, Android 13+ ikinci retten sonra); o kullanıcı
 * ders hatırlatmalarını da ödev bildirimlerini de sessizce kaçırıyordu ve
 * panelde bunu düzeltebileceği bir yer yoktu. Bu kart, izin kapalıysa
 * uygulamanın her açılışında çıkar ve tek dokunuşla doğru ayar sayfasına
 * götürür. Kullanıcı ayarlardan dönünce izin açılmışsa cihaz kendiliğinden
 * kaydolur.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BellOff } from "lucide-react";
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
import { surumDurumu, surumUyarisi } from "@/lib/appRelease";
import { basariGoster, hataGoster } from "@/lib/notify";
import { isIOS, isNative } from "@/lib/platform";
import { bildirimAyarlariniAc, bildirimIzniDurumu, initPushNotifications } from "@/lib/pushNotifications";

/**
 * Arka plandan dönüşte kartı yeniden göstermeden önce beklenecek süre.
 * Kamera ya da dosya seçici de uygulamayı "arka plana alıp geri getirir";
 * eşik olmasa ödev fotoğrafı çekip dönen kullanıcının önüne kart çıkardı.
 */
const YENIDEN_GOSTERME_MS = 60 * 60 * 1000;
/** Panel çizilsin ve ilk kurulumdaki sistem izin penceresiyle çakışmasın. */
const ILK_YOKLAMA_MS = 1500;

interface BildirimHatirlatmaProps {
  userId: string;
  role: "teacher" | "student" | "admin";
}

export function BildirimHatirlatma({ userId, role }: BildirimHatirlatmaProps) {
  const [acik, setAcik] = useState(false);
  const sonGosterim = useRef(0);
  const ayarlaraGidildi = useRef(false);

  const yokla = useCallback(async () => {
    const durum = await bildirimIzniDurumu();

    if (durum === "granted") {
      setAcik(false);
      if (ayarlaraGidildi.current) {
        ayarlaraGidildi.current = false;
        await initPushNotifications(userId, role);
        basariGoster("Bildirimler açıldı.");
      }
      return;
    }

    if (durum === "denied" && Date.now() - sonGosterim.current >= YENIDEN_GOSTERME_MS) {
      // Önce güncelleme: sürüm uyarısı ekrandaysa bu kart sıradaki açılışı bekler.
      await surumDurumu();
      if (surumUyarisi.acikMi()) return;
      sonGosterim.current = Date.now();
      setAcik(true);
    }
  }, [userId, role]);

  useEffect(() => {
    if (!isNative) return;
    const timer = setTimeout(yokla, ILK_YOKLAMA_MS);
    return () => clearTimeout(timer);
  }, [yokla]);

  useAppResume(() => {
    if (isNative) yokla();
  });

  if (!isNative) return null;

  const ayarlariAc = async () => {
    ayarlaraGidildi.current = true;
    try {
      await bildirimAyarlariniAc();
    } catch (error) {
      ayarlaraGidildi.current = false;
      hataGoster(error, "Ayarlar açılamadı. Telefonunuzun Ayarlar › Bildirimler bölümünden açabilirsiniz.");
    }
  };

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5 shrink-0" aria-hidden />
            Bildirimler kapalı
          </DialogTitle>
          <DialogDescription>
            Ders hatırlatmaları ve ödev bildirimleri bu telefona ulaşmıyor.
          </DialogDescription>
        </DialogHeader>

        <p className="text-[15px] leading-relaxed">
          Açmak için aşağıdaki düğmeye dokunun.{" "}
          {isIOS
            ? "Açılan sayfada “Bildirimler”e girip “Bildirimlere İzin Ver”i açın."
            : "Açılan sayfada en üstteki anahtarı açın."}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAcik(false)}>
            Şimdi değil
          </Button>
          <Button onClick={ayarlariAc}>Bildirimleri Aç</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
