/**
 * Sürüm kapısı — mağaza uygulaması eski kaldıysa kullanıcıya söyler.
 *
 * Uygulama web paketini içinde taşıyor: siteye yeni sürüm yüklemek telefonları
 * güncellemiyor. Eski paket, veritabanı değiştikçe sessizce bozuluyordu ve
 * kullanıcıya "güncelleyin" demenin bir yolu yoktu. Açılışta
 * `app_settings.app_release` satırı okunur ve bu cihazın mağaza derleme
 * numarasıyla karşılaştırılır (bkz. supabase/migrations/…_surum_kapisi.sql).
 *
 * Kapı asla yanlışlıkla kilitlememeli: ağ yoksa, satır yoksa ya da derleme
 * numarası okunamıyorsa sonuç her zaman "guncel"dir.
 */
import { supabase } from "@/integrations/supabase/client";
import { isIOS, isNative } from "./platform";
import { APP_STORE_URL, PLAY_STORE_URL } from "./site";

export type SurumDurumu =
  /** Kullanılabilir; bir şey gösterme. */
  | "guncel"
  /** Daha yeni sürüm var; kapatılabilir kart. */
  | "onerilen"
  /** Bu derleme artık desteklenmiyor; kapatılamayan ekran. */
  | "zorunlu";

interface PlatformSurumu {
  minBuild?: number;
  latestBuild?: number;
}

/** Aynı açılışta birden çok bileşen sorabiliyor; ağa bir kez gidilsin. */
const ORTAK_SORGU_MS = 30_000;
let sonSorgu: { zaman: number; sonuc: Promise<SurumDurumu> } | null = null;

export function surumDurumu(): Promise<SurumDurumu> {
  if (sonSorgu && Date.now() - sonSorgu.zaman < ORTAK_SORGU_MS) return sonSorgu.sonuc;
  sonSorgu = { zaman: Date.now(), sonuc: sorgula() };
  return sonSorgu.sonuc;
}

async function sorgula(): Promise<SurumDurumu> {
  if (!isNative) return "guncel";

  try {
    const [{ App }, { data, error }] = await Promise.all([
      import("@capacitor/app"),
      supabase.from("app_settings").select("value").eq("key", "app_release").maybeSingle(),
    ]);
    if (error || !data) return "guncel";

    const build = Number((await App.getInfo()).build);
    if (!Number.isFinite(build) || build <= 0) return "guncel";

    const ayar = (data.value as Record<string, PlatformSurumu> | null)?.[isIOS ? "ios" : "android"];
    if (!ayar) return "guncel";

    if (typeof ayar.minBuild === "number" && build < ayar.minBuild) return "zorunlu";
    if (typeof ayar.latestBuild === "number" && build < ayar.latestBuild) return "onerilen";
    return "guncel";
  } catch {
    return "guncel";
  }
}

/**
 * Mağaza sayfasını açar. Capacitor uygulama dışı üst düzey gezinmeleri sisteme
 * devrediyor: iOS'ta App Store, Android'de Play Store uygulaması açılır.
 */
export function magazayiAc(): void {
  window.location.href = isIOS ? APP_STORE_URL : PLAY_STORE_URL;
}

/** Aynı açılışta iki kart üst üste binmesin: sürüm uyarısı açıkken diğerleri bekler. */
let uyariAcik = false;
export const surumUyarisi = {
  acikMi: () => uyariAcik,
  ayarla: (acik: boolean) => {
    uyariAcik = acik;
  },
};
