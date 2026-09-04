import { useEffect, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { CountBox, EmptyState } from "@/components/panel/PanelBits";
import { supabase } from "@/integrations/supabase/client";
import { formatMinutes } from "@/lib/panelFormat";
import { feeForMinutes, feeForPayment, formatMoney, ratePerMinute, type TeacherPay } from "@/lib/teacherPay";

interface PaymentRow {
  id: string;
  amount_minutes: number;
  completed_regular_lessons: number;
  completed_trial_lessons: number;
  payment_date: string;
  notes: string | null;
  rate_per_minute: number | null;
}

interface BalanceScreenProps {
  teacherId: string;
  /** Panel anlık görüntüsünden gelen değerler — ilk boyama anında. */
  totalMinutes: number;
  regularLessons: number;
  trialLessons: number;
  /** Dakika → ücret dönüşüm ayarı. */
  pay: TeacherPay;
}

/**
 * Bakiye ekranı — işlenen süre, ders kırılımı ve ödeme geçmişi.
 * Toplam ve sayaçlar panel anlık görüntüsünden geldiği için anında çizilir;
 * yalnızca ödeme geçmişi ağdan yüklenir.
 */
export function BalanceScreen({ teacherId, totalMinutes, regularLessons, trialLessons, pay }: BalanceScreenProps) {
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("payment_history")
        .select("*")
        .eq("teacher_id", teacherId)
        .order("payment_date", { ascending: false });
      if (!cancelled) {
        setHistory(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  return (
    <div className="flex flex-col gap-4 py-5">
      <div className="pnl-card p-5 md:p-7" style={{ background: "var(--ewd-yellow-pale)", borderColor: "var(--ewd-yellow)" }}>
        <span className="pnl-about__label">ÖDENECEK TUTAR</span>
        <p
          className="mt-2 text-[30px] font-black leading-none tracking-[-0.02em] md:text-[34px]"
          style={{ color: "var(--ewd-on-surface)" }}
        >
          {formatMoney(feeForMinutes(totalMinutes, pay), pay)}
        </p>
        <p className="mt-2 text-[13px] font-semibold" style={{ color: "var(--ewd-yellow-ink-2)" }}>
          {formatMinutes(totalMinutes)} · {pay.lessonMinutes} dk ders = {formatMoney(pay.lessonFee, pay, true)}{" "}
          (dakika başı {formatMoney(ratePerMinute(pay), pay)})
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CountBox value={regularLessons} label="Normal ders" />
        <CountBox value={trialLessons} label="Deneme dersi" tone="yellow" />
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="pnl-divider__label pt-2">Ödeme geçmişi</h3>
        {loading ? (
          <div className="h-20 animate-pulse rounded-3xl" style={{ background: "var(--ewd-lilac-tint)" }} />
        ) : history.length === 0 ? (
          <EmptyState title="Henüz ödeme kaydı yok" text="Ödemeler kaydedildiğinde burada listelenir." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {history.map((row) => (
              <li key={row.id} className="pnl-card pnl-card--flat flex items-center gap-4 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold" style={{ color: "var(--ewd-on-surface)" }}>
                    {formatMoney(feeForPayment(row.amount_minutes, row.rate_per_minute, pay), pay)}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: "var(--ewd-on-surface-faint)" }}>
                    {formatMinutes(row.amount_minutes)}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--ewd-on-surface-faint)" }}>
                    {row.completed_regular_lessons} normal · {row.completed_trial_lessons} deneme
                    {row.notes ? ` · ${row.notes}` : ""}
                  </span>
                </div>
                <span className="shrink-0 text-xs font-bold" style={{ color: "var(--ewd-on-surface-soft)" }}>
                  {format(new Date(row.payment_date), "dd MMM yyyy", { locale: tr })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
