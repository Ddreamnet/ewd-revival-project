import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/panel/PanelBits";
import { hataGoster } from "@/lib/notify";
import { formatTime } from "@/lib/lessonTypes";
import { toneForName } from "@/lib/panelFormat";
import {
  fetchActualLessonsForWeek,
  getWeekStartForOffset,
  prefetchWeek,
  type ActualLesson,
} from "@/hooks/useScheduleGrid";

/**
 * Öğretmenin haftalık ders programı.
 *
 * Neden yeni bir bileşen: panelde bir `WeeklySchedule.tsx` vardı ama hiçbir
 * yerden import edilmiyordu (v2 yeniden tasarımında bölüm kaldırılmış, dosya
 * kalmıştı) ve admin diliyle yazılmıştı — `min-w-[900px]` bir tablo. 390px'lik
 * telefonda 900px'lik tabloyu yana kaydırmak öğretmenin işine yaramıyor.
 *
 * Buradaki düzen iki ekranda da aynı bilgiyi veriyor ama yatay kaydırma yok:
 * gün gün kartlar, her kartta o günün dersleri saat sırasıyla. Masaüstünde
 * kartlar iki sütuna açılıyor, mobilde tek sütun. Bugün vurgulanıyor.
 *
 * Salt okunur: dersi işaretleme öğrencinin ders rayından yürüyor, burada
 * ikinci bir yol açmak aynı işi iki yerde yapmak olurdu.
 */

interface Props {
  teacherId: string;
  /** Diyalog kapalıyken sorgu atılmasın. */
  active: boolean;
}

/** Pazartesi'den başlayan gün dizisi — DB'de Pazar 0, Pazartesi 1. */
const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

/**
 * Deneme dersi kaydında öğrenci adı yok — tablo yalnızca öğretmenin takvimine
 * ayrılmış bir slot tutuyor (henüz kayıtlı öğrenci olmadığı için).
 */
interface DenemeDersi {
  id: string;
  lesson_date: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
}

/** Bir günün satırı — normal ve deneme dersleri tek listede. */
interface GunDersi {
  id: string;
  baslangic: string;
  bitis: string;
  ogrenci: string;
  dersNo: number | null;
  tamamlandi: boolean;
  deneme: boolean;
  tasindi: boolean;
}

export function WeeklyScheduleScreen({ teacherId, active }: Props) {
  const [haftaFarki, setHaftaFarki] = useState(0);
  const [dersler, setDersler] = useState<ActualLesson[]>([]);
  const [denemeler, setDenemeler] = useState<DenemeDersi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const haftaBasi = useMemo(() => getWeekStartForOffset(haftaFarki), [haftaFarki]);
  const haftaSonu = useMemo(() => addDays(haftaBasi, 6), [haftaBasi]);
  const haftaEtiketi = `${format(haftaBasi, "d MMM", { locale: tr })} – ${format(haftaSonu, "d MMM yyyy", { locale: tr })}`;

  const yukle = useCallback(async () => {
    if (!teacherId) return;
    setYukleniyor(true);
    try {
      const baslangic = format(haftaBasi, "yyyy-MM-dd");
      const bitis = format(haftaSonu, "yyyy-MM-dd");

      // Normal dersler önbellekli yardımcıdan; deneme dersleri aynı hafta
      // aralığında tek sorguyla. İkisi paralel gidiyor.
      const [normal, denemeRes] = await Promise.all([
        fetchActualLessonsForWeek(teacherId, haftaBasi),
        supabase
          .from("trial_lessons")
          .select("id, lesson_date, start_time, end_time, is_completed")
          .eq("teacher_id", teacherId)
          .gte("lesson_date", baslangic)
          .lte("lesson_date", bitis)
          .order("start_time"),
      ]);

      if (denemeRes.error) throw denemeRes.error;
      setDersler(normal);
      setDenemeler((denemeRes.data ?? []) as DenemeDersi[]);
    } catch (error) {
      hataGoster(error, "Ders programı yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, [teacherId, haftaBasi, haftaSonu]);

  useEffect(() => {
    if (!active) return;
    yukle();
    // Komşu haftalar arka planda insin: ok tuşuna basınca bekleme olmasın.
    prefetchWeek(teacherId, getWeekStartForOffset(haftaFarki + 1));
    prefetchWeek(teacherId, getWeekStartForOffset(haftaFarki - 1));
  }, [active, yukle, teacherId, haftaFarki]);

  /** Gün indeksine (0=Pzt) göre gruplanmış, saate göre sıralı dersler. */
  const gunlereGore = useMemo(() => {
    const kutular: GunDersi[][] = Array.from({ length: 7 }, () => []);
    const indeks = (tarih: string) => {
      // `yyyy-MM-dd` yerel gün olarak okunmalı; new Date(str) UTC varsayar ve
      // Türkiye'de günü bir geri kaydırabilir.
      const [y, a, g] = tarih.split("-").map(Number);
      const d = new Date(y, a - 1, g);
      const fark = Math.round((d.getTime() - haftaBasi.getTime()) / 86_400_000);
      return fark >= 0 && fark < 7 ? fark : -1;
    };

    for (const l of dersler) {
      const i = indeks(l.lesson_date);
      if (i < 0) continue;
      kutular[i].push({
        id: l.id,
        baslangic: l.start_time,
        bitis: l.end_time,
        ogrenci: l.student_name,
        dersNo: l.lesson_number,
        tamamlandi: l.status === "completed",
        deneme: false,
        tasindi: Boolean(l.original_date) || l.is_manual_override,
      });
    }
    for (const d of denemeler) {
      const i = indeks(d.lesson_date);
      if (i < 0) continue;
      kutular[i].push({
        id: d.id,
        baslangic: d.start_time,
        bitis: d.end_time,
        ogrenci: "Deneme dersi",
        dersNo: null,
        tamamlandi: d.is_completed,
        deneme: true,
        tasindi: false,
      });
    }
    kutular.forEach((g) => g.sort((a, b) => a.baslangic.localeCompare(b.baslangic)));
    return kutular;
  }, [dersler, denemeler, haftaBasi]);

  const toplam = gunlereGore.reduce((n, g) => n + g.length, 0);
  const bugun = new Date();

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* ── Hafta gezinmesi ── */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="pnl-iconbtn pnl-iconbtn--sm"
          onClick={() => setHaftaFarki((o) => o - 1)}
          aria-label="Önceki hafta"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-col items-center">
          <span
            className="truncate text-[15px] font-black tracking-[-0.01em]"
            style={{ color: "var(--ewd-on-surface)" }}
          >
            {haftaEtiketi}
          </span>
          <span className="pnl-welcome">
            {haftaFarki === 0 ? "Bu hafta" : haftaFarki < 0 ? `${-haftaFarki} hafta önce` : `${haftaFarki} hafta sonra`}
            {" · "}
            {toplam} ders
          </span>
        </div>

        <button
          type="button"
          className="pnl-iconbtn pnl-iconbtn--sm"
          onClick={() => setHaftaFarki((o) => o + 1)}
          aria-label="Sonraki hafta"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {haftaFarki !== 0 && (
        <button
          type="button"
          className="pnl-btn pnl-btn--soft pnl-btn--block"
          onClick={() => setHaftaFarki(0)}
        >
          Bu haftaya dön
        </button>
      )}

      {/* ── Gün kartları ── */}
      {yukleniyor ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-[104px] animate-pulse rounded-[22px]"
              style={{ background: "var(--ewd-lilac-tint)" }}
            />
          ))}
        </div>
      ) : toplam === 0 ? (
        <EmptyState
          title="Bu hafta ders yok"
          text="Planlanmış bir ders olduğunda burada gün gün listelenir."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {GUNLER.map((gunAdi, i) => {
            const gunDersleri = gunlereGore[i];
            if (gunDersleri.length === 0) return null;
            const tarih = addDays(haftaBasi, i);
            const bugunMu = isSameDay(tarih, bugun);

            return (
              <section
                key={gunAdi}
                className="pnl-card p-4"
                style={
                  bugunMu
                    ? { borderColor: "var(--ewd-purple)", background: "var(--ewd-accent-wash)" }
                    : undefined
                }
                aria-label={`${gunAdi} dersleri`}
              >
                <header className="flex items-baseline justify-between gap-2 pb-2.5">
                  <h3
                    className="text-[15px] font-black tracking-[-0.01em]"
                    style={{ color: "var(--ewd-on-surface)" }}
                  >
                    {gunAdi}
                    {bugunMu && <span className="pnl-tag pnl-tag--today ml-2">bugün</span>}
                  </h3>
                  <span className="pnl-welcome shrink-0">
                    {format(tarih, "d MMM", { locale: tr })} · {gunDersleri.length} ders
                  </span>
                </header>

                <ul className="flex flex-col gap-2">
                  {gunDersleri.map((ders) => {
                    const ton = toneForName(ders.ogrenci);
                    return (
                      <li
                        key={ders.id}
                        className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                        style={{ background: "var(--ewd-surface-3)" }}
                      >
                        {/* Saat sabit genişlikte: satırlar alt alta hizalı dursun. */}
                        <span
                          className="w-[46px] shrink-0 text-[13px] font-black tabular-nums"
                          style={{ color: "var(--ewd-on-surface)" }}
                        >
                          {formatTime(ders.baslangic)}
                        </span>

                        <span className="flex min-w-0 flex-1 flex-col">
                          <span
                            className="truncate text-[14px] font-extrabold"
                            style={{
                              color:
                                ton === "pink" ? "var(--ewd-pink-ink)" : "var(--ewd-on-lilac)",
                            }}
                          >
                            {ders.ogrenci}
                          </span>
                          <span className="pnl-welcome">
                            {formatTime(ders.baslangic)}–{formatTime(ders.bitis)}
                            {ders.dersNo ? ` · ${ders.dersNo}. ders` : ""}
                          </span>
                        </span>

                        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          {ders.deneme && <span className="pnl-tag pnl-tag--new">deneme</span>}
                          {ders.tasindi && <span className="pnl-chip">taşındı</span>}
                          {ders.tamamlandi && <span className="pnl-tag pnl-tag--today">işlendi</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
