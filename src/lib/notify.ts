/**
 * Panelin tek bildirim ve hata kapısı.
 *
 * Öncesinde iki ayrı toast sistemi yan yana çalışıyordu (shadcn `useToast`
 * 25 dosyada, `sonner` 5 dosyada) ve ikisi de App'te mount edilmişti: aynı
 * admin panelinde bakiye işlemi bir köşede, ders programı işlemi başka bir
 * köşede ve başka stilde bildirim gösteriyordu. Buradan geçen her çağrı aynı
 * yerde ve aynı biçimde çıkıyor.
 *
 * İkinci iş: ham veritabanı hatasını kullanıcıya göstermemek. Otuz ayrı yerde
 *
 *     catch (error: any) { toast({ description: error.message, ... }) }
 *
 * yazılıydı; öğretmen ekranında
 * `duplicate key value violates unique constraint "student_lessons_pkey"`
 * görüyordu. Hem anlaşılmıyor hem de şema adlarını dışarı veriyor.
 */
import { toast as baseToast } from "@/hooks/use-toast";

/** PostgREST / Postgres kodlarının insan diline karşılığı. */
const KOD_MESAJLARI: Record<string, string> = {
  "23505": "Bu kayıt zaten var.",
  "23503": "Bağlı kayıtlar olduğu için bu işlem yapılamıyor.",
  "23514": "Girilen değer kabul edilmedi.",
  "22P02": "Girilen değer beklenen biçimde değil.",
  "42501": "Bu işlem için yetkiniz yok.",
  "40001": "Kayıt aynı anda başka bir yerden değişti; tekrar deneyin.",
  "55P03": "Kayıt şu anda başka bir işlem tarafından kullanılıyor; tekrar deneyin.",
  PGRST116: "Kayıt bulunamadı.",
  PGRST301: "Oturumun süresi doldu. Yeniden giriş yapın.",
};

/**
 * Supabase Auth hataları İngilizce geliyor ("Invalid login credentials").
 * Giriş ekranı sitenin en çok görülen formu; kullanıcı kendi dilinde
 * okuyabilmeli.
 */
const AUTH_MESAJLARI: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "E-posta ya da şifre hatalı."],
  [/email not confirmed/i, "E-posta adresin henüz doğrulanmamış."],
  [/user not found/i, "Bu e-posta ile kayıtlı bir hesap yok."],
  [/invalid email/i, "E-posta adresi geçerli görünmüyor."],
  [/password should be at least/i, "Şifre en az 6 karakter olmalı."],
  [/email rate limit|too many requests|rate limit/i, "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene."],
  [/user already registered|already been registered/i, "Bu e-posta zaten kayıtlı."],
  [/network|fetch/i, "Bağlantı kurulamadı. İnternetini kontrol et."],
];

/** Auth hatasını Türkçeye çevirir; eşleşme yoksa yedeği döner. */
export function authHataMesaji(error: unknown, yedek = "Giriş yapılamadı"): string {
  const m = (error as { message?: string })?.message ?? "";
  for (const [kalip, metin] of AUTH_MESAJLARI) if (kalip.test(m)) return metin;
  return yedek;
}

/** Ağ kopması ve benzeri, koda bağlanamayan durumlar. */
function agHatasiMi(error: unknown): boolean {
  const m = (error as { message?: string })?.message ?? "";
  return /failed to fetch|networkerror|load failed|net::/i.test(m);
}

export function hataMesaji(error: unknown, yedek: string): string {
  const kod = (error as { code?: string })?.code;
  if (kod && KOD_MESAJLARI[kod]) return KOD_MESAJLARI[kod];
  if (agHatasiMi(error)) return "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.";
  return yedek;
}

/**
 * Hata bildirimi.
 * `yedek`, koda karşılık gelmeyen durumlarda gösterilecek metin — çağıran
 * tarafın bağlamı olduğu için "Konu oluşturulamadı" gibi somut yazılmalı.
 */
export function hataGoster(error: unknown, yedek = "İşlem tamamlanamadı"): void {
  // Ham hata yalnızca geliştirme konsoluna; kullanıcıya çevirisi gidiyor.
  if (import.meta.env.DEV) console.error("[hata]", error);
  baseToast({
    title: "Hata",
    description: hataMesaji(error, yedek),
    variant: "destructive",
  });
}

/** Başarı bildirimi. */
export function basariGoster(description: string, title = "Başarılı"): void {
  baseToast({ title, description });
}

/** Doğrulama uyarısı — kullanıcı hatası, sistem hatası değil. */
export function uyariGoster(description: string): void {
  baseToast({ title: "Eksik bilgi", description, variant: "destructive" });
}

/**
 * `sonner` uyumlu ince kabuk.
 *
 * Beş dosya `import { toast } from "sonner"` ile yazılmıştı. Çağrı yerlerini
 * tek tek değiştirmek yerine imzayı burada karşılıyoruz: `import` satırı
 * `@/lib/notify`'a dönünce bildirimler tek Toaster'dan çıkıyor, gövde
 * dokunulmadan kalıyor.
 */
export const toast = {
  success: (message: string) => basariGoster(message),
  error: (message: string) => baseToast({ title: "Hata", description: message, variant: "destructive" }),
  info: (message: string) => baseToast({ title: "Bilgi", description: message }),
};

/**
 * `lessonService` tarzı `{ success, error }` dönen çağrılar için.
 * Başarılıysa true döner ve başarı mesajını gösterir.
 */
export function sonucBildir(
  sonuc: { success: boolean; error?: string | null },
  basariMetni: string,
  hataYedegi: string,
): boolean {
  if (sonuc.success) {
    basariGoster(basariMetni);
    return true;
  }
  if (import.meta.env.DEV) console.error("[hata]", sonuc.error);
  baseToast({ title: "Hata", description: sonuc.error || hataYedegi, variant: "destructive" });
  return false;
}
