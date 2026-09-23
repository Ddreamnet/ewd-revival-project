/**
 * Menüdeki "Bildirimler" satırı — yalnızca uygulamada (native).
 *
 * İlk açılıştaki izin penceresi "İzin Verme" ile geçilince bildirimi geri
 * açmanın uygulama içinde kalıcı bir yolu yoktu: hatırlatma kartı ancak saatte
 * bir çıkıyor ve "Şimdi değil" denince kayboluyor. Bu satır her zaman menüde
 * durur, sağında durumu yazar; dokununca izin penceresini gösterir, izin
 * reddedilmişse doğrudan telefonun ayar sayfasını açar.
 *
 * Menü yalnızca dar ekranda var; iPad'de (md+) paneller `kapali` iken
 * başlığa ayrı bir düğme koyuyor.
 */
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import type { PanelMenuItem } from "@/components/panel/PanelMenu";
import { useAppResume } from "@/hooks/usePanelPlatform";
import { basariGoster, hataGoster } from "@/lib/notify";
import { isNative } from "@/lib/platform";
import { bildirimIzniDurumu, bildirimleriAc, type BildirimIzni } from "@/lib/pushNotifications";

export function useBildirimMenuOgesi(
  userId: string | undefined,
  role: "teacher" | "student" | "admin",
): { ogesi: PanelMenuItem | null; kapali: boolean } {
  const [durum, setDurum] = useState<BildirimIzni>("unsupported");

  const yenile = useCallback(async () => {
    if (isNative) setDurum(await bildirimIzniDurumu());
  }, []);

  useEffect(() => {
    yenile();
  }, [yenile]);

  useAppResume(yenile);

  if (!isNative || !userId || durum === "unsupported") return { ogesi: null, kapali: false };

  const acik = durum === "granted";

  const ogesi: PanelMenuItem = {
    label: "Bildirimler",
    icon: acik ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />,
    trailing: (
      <span className={acik ? "text-xs text-muted-foreground" : "text-xs font-bold text-destructive"}>
        {acik ? "Açık" : "Kapalı"}
      </span>
    ),
    onSelect: async () => {
      try {
        const sonuc = await bildirimleriAc(userId, role);
        setDurum(sonuc);
        if (sonuc === "granted") basariGoster(acik ? "Bildirimler bu telefonda açık." : "Bildirimler açıldı.");
      } catch (error) {
        hataGoster(error, "Ayarlar açılamadı. Telefonunuzun Ayarlar › Bildirimler bölümünden açabilirsiniz.");
      }
    },
  };
  return { ogesi, kapali: !acik };
}
