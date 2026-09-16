import { supabase } from "@/integrations/supabase/client";

/**
 * Edge fonksiyonu çağırır ve gerçek hata metnini döndürür.
 *
 * supabase-js `functions.invoke` 2xx olmayan cevapta gövdeyi `error.context`
 * içinde saklıyor ve `error.message` olarak yalnızca "Edge Function returned a
 * non-2xx status code" veriyor. Admin bu yüzden "şifre en az 6 karakter"
 * yerine anlamsız bir İngilizce cümle görüyordu — 16 Eylül'de Erva adlı
 * öğrenci bu yüzden eklenemedi. Burada gövde açılıp asıl mesaj okunuyor.
 *
 * Fonksiyonlar iş kuralı retlerini 200 + `{ success: false, error }` olarak
 * döndürüyor; oturum ve yetki sorunları 401/403. İkisi de aynı yere düşer.
 */
export async function edgeCagir<T extends object = Record<string, unknown>>(
  ad: string,
  govde: unknown
): Promise<{ veri: T | null; hata: string | null }> {
  const { data, error } = await supabase.functions.invoke(ad, { body: govde });

  if (error) {
    let metin: string | null = null;
    const baglam = (error as { context?: unknown }).context;
    if (baglam instanceof Response) {
      try {
        const b = (await baglam.clone().json()) as { error?: unknown };
        if (typeof b?.error === "string") metin = b.error;
      } catch {
        // Gövde JSON değil; genel mesaja düş.
      }
    }
    return {
      veri: null,
      hata: metin ?? "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
    };
  }

  const d = data as (T & { success?: boolean; error?: string }) | null;
  if (d && (d.success === false || typeof d.error === "string")) {
    return { veri: d, hata: d.error ?? "İşlem tamamlanamadı." };
  }
  return { veri: d, hata: null };
}

/** Basit e-posta biçim denetimi — sunucudaki denetimle aynı kural. */
export const EPOSTA_BICIMI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
