/**
 * Öğretmen ücreti — dakika bakiyesinin para karşılığı.
 *
 * Sistem dersi dakika olarak sayıyor (`teacher_balance.total_minutes`); ödeme
 * ise ders başına yapılıyor. Dönüşüm tek bir orandan geçiyor:
 *
 *     dakika başı ücret = lessonFee / lessonMinutes      (220 / 30 ≈ 7,33 ₺)
 *
 * Ayrıca öğretmen her öğrencisi için ay sonu rapor çıkarıyor; her rapor
 * bakiyeye `reportMinutes` (5 dk) olarak ekleniyor — böylece rapor da aynı
 * orandan ücretlendiriliyor, ayrı bir kalem tutmaya gerek kalmıyor.
 *
 * Ayar `app_settings` tablosunda duruyor ve admin panelinden değiştiriliyor.
 * Dil şubeleri ayrı ücretlendirilebildiği için her şubenin kendi anahtarı var
 * (bkz. `teacherPayKey`). Satır yoksa aşağıdaki varsayılan geçerli, yani
 * veritabanına dokunulmadan da doğru çalışır.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Branch } from "./branch";

export interface TeacherPay {
  /** Bir dersin dakika cinsinden süresi (ücret referansı). */
  lessonMinutes: number;
  /** O ders için öğretmene ödenen tutar. */
  lessonFee: number;
  /** Ay sonu öğrenci raporu başına bakiyeye eklenen dakika. */
  reportMinutes: number;
  currency: string;
}

export const DEFAULT_TEACHER_PAY: TeacherPay = {
  lessonMinutes: 30,
  lessonFee: 220,
  reportMinutes: 5,
  currency: "TRY",
};

export const TEACHER_PAY_KEY = "teacher_pay";

/**
 * Şubenin ücret anahtarı.
 *
 * İngilizce şube eski `teacher_pay` anahtarında bırakıldı: kayıtlı satır
 * olduğu gibi geçerli kalıyor, veri göçü gerekmiyor ve mağazadan henüz
 * güncellenmemiş eski uygulama sürümleri de doğru tutarı okumaya devam
 * ediyor. Yeni şubeler kendi anahtarını alıyor.
 */
export function teacherPayKey(branch: Branch): string {
  return branch === "en" ? TEACHER_PAY_KEY : `${TEACHER_PAY_KEY}_${branch}`;
}

/** Dakika başı ücret. */
export function ratePerMinute(pay: TeacherPay): number {
  if (!pay.lessonMinutes) return 0;
  return pay.lessonFee / pay.lessonMinutes;
}

/** Dakika bakiyesinin para karşılığı. */
export function feeForMinutes(minutes: number, pay: TeacherPay): number {
  return (minutes || 0) * ratePerMinute(pay);
}

/**
 * Kaydedilmiş bir ödemenin tutarı.
 * Ödeme anındaki oran satırda saklıysa o kullanılır; oran sonradan
 * değiştiğinde geçmiş kayıtların tutarı değişmesin diye. Eski satırlarda
 * oran yok, o zaman güncel oran uygulanır.
 */
export function feeForPayment(
  minutes: number,
  storedRate: number | null | undefined,
  pay: TeacherPay,
): number {
  const rate = typeof storedRate === "number" && storedRate > 0 ? storedRate : ratePerMinute(pay);
  return (minutes || 0) * rate;
}

/**
 * Tutarı Türk Lirası olarak yazar.
 * `compact` — pill gibi dar yerlerde kuruşsuz.
 */
export function formatMoney(amount: number, pay: TeacherPay, compact = false): string {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: pay.currency || "TRY",
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 0 : 2,
    }).format(amount || 0);
  } catch {
    return `${Math.round(amount || 0)} ₺`;
  }
}

function normalize(raw: unknown): TeacherPay {
  if (!raw || typeof raw !== "object") return DEFAULT_TEACHER_PAY;
  const v = raw as Partial<Record<keyof TeacherPay, unknown>>;
  const num = (x: unknown, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) && x > 0 ? x : fallback;
  return {
    lessonMinutes: num(v.lessonMinutes, DEFAULT_TEACHER_PAY.lessonMinutes),
    lessonFee: num(v.lessonFee, DEFAULT_TEACHER_PAY.lessonFee),
    // 0 geçerli bir değer: rapor ücretlendirilmiyor olabilir.
    reportMinutes:
      typeof v.reportMinutes === "number" && Number.isFinite(v.reportMinutes) && v.reportMinutes >= 0
        ? v.reportMinutes
        : DEFAULT_TEACHER_PAY.reportMinutes,
    currency: typeof v.currency === "string" && v.currency ? v.currency : DEFAULT_TEACHER_PAY.currency,
  };
}

export async function fetchTeacherPay(branch: Branch): Promise<TeacherPay> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", teacherPayKey(branch))
    .maybeSingle();
  if (error || !data) return DEFAULT_TEACHER_PAY;
  return normalize(data.value);
}

/** Yalnızca admin yazabilir (RLS). */
export async function saveTeacherPay(
  pay: TeacherPay,
  adminUserId: string | undefined,
  branch: Branch,
): Promise<{ error?: string }> {
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: teacherPayKey(branch),
      value: normalize(pay) as unknown as Record<string, number | string>,
      updated_at: new Date().toISOString(),
      updated_by: adminUserId ?? null,
    },
    { onConflict: "key" },
  );
  return error ? { error: error.message } : {};
}
