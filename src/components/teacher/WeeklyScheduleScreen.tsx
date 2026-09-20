import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/panel/PanelBits";
import { hataGoster, sonucBildir } from "@/lib/notify";
import { completeLesson, undoCompleteLesson } from "@/lib/lessonService";
import { formatTime } from "@/lib/lessonTypes";
import { toneForName } from "@/lib/panelFormat";
import {
  clearWeekCache,
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
 * Paket dersleri buradan işaretlenmez: onların yeri öğrencinin ders rayı ve
 * orada sıra kuralı işliyor. DENEME dersleri ise istisna — bir öğrenci kartına
 * bağlı olmadıkları için hiçbir rayda görünmüyorlar ve öğretmenin onları
 * işaretleyecek tek bir yeri yoktu. Bu yüzden yalnızca deneme satırları
 * tıklanabilir.
 */

interface Props {
  teacherId: string;
  /** Diyalog kapalıyken sorgu atılmasın. */
  active: boolean;
  /** Deneme dersi işaretlenince panel bakiyesi tazelensin. */
  onChanged?: () => void;
}

/** Pazartesi'den başlayan gün dizisi — DB'de Pazar 0, Pazartesi 1. */
const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

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

export function WeeklyScheduleScreen({ teacherId, active, onChanged }: Props) {
  const [haftaFarki, setHaftaFarki] = useState(0);
  const [dersler, setDersler] = useState<ActualLesson[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const haftaBasi = useMemo(() => getWeekStartForOffset(haftaFarki), [haftaFarki]);
  const haftaSonu = useMemo(() => addDays(haftaBasi, 6), [haftaBasi]);
  const haftaEtiketi = `${format(haftaBasi, "d MMM", { locale: tr })} – ${format(haftaSonu, "d MMM yyyy", { locale: tr })}`;

  /** Onay bekleyen deneme dersi — tıklanan satır. */
  const [denemeOnay, setDenemeOnay] = useState<GunDersi | null>(null);
  const [isleniyor, setIsleniyor] = useState(false);

  /**
   * @param sessiz Ekrandaki haftayı tazelerken doğru geçilir: liste yerinde
   *   kalır, iskelete dönüp geri gelmez. Hafta değişiminde iskelet doğru —
   *   önceki haftanın dersleri yeni başlığın altında durmasın.
   */
  const yukle = useCallback(async (sessiz = false) => {
    if (!teacherId) return;
    if (!sessiz) setYukleniyor(true);
    try {
      // Deneme dersleri de ders takviminin satırları; ayrı sorgu kalktı.
      setDersler(await fetchActualLessonsForWeek(teacherId, haftaBasi));
    } catch (error) {
      hataGoster(error, "Ders programı yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, [teacherId, haftaBasi]);

  useEffect(() => {
    if (!active) return;
    yukle();
    // Komşu haftalar arka planda insin: ok tuşuna basınca bekleme olmasın.
    prefetchWeek(teacherId, getWeekStartForOffset(haftaFarki + 1));
    prefetchWeek(teacherId, getWeekStartForOffset(haftaFarki - 1));
  }, [active, yukle, teacherId, haftaFarki]);

  /**
   * Deneme dersini işlendi/işlenmedi olarak işaretler.
   *
   * Arka uç bunu zaten biliyordu: `rpc_complete_lesson` deneme dersinde
   * süreyi bakiyeye `trial_complete` olarak yazıyor, geri alma da
   * `trial_undo` ile düşüyor. Eksik olan yalnızca bu düğmeydi.
   */
  const denemeIsaretle = async () => {
    if (!denemeOnay || isleniyor) return;
    setIsleniyor(true);
    const geriAl = denemeOnay.tamamlandi;
    try {
      const sonuc = geriAl
        ? await undoCompleteLesson(denemeOnay.id, teacherId)
        : await completeLesson(denemeOnay.id, teacherId);
      const oldu = sonucBildir(
        sonuc,
        geriAl ? "Deneme dersi geri alındı" : "Deneme dersi işlendi olarak işaretlendi",
        geriAl ? "Deneme dersi geri alınamadı" : "Deneme dersi işaretlenemedi",
      );
      if (!oldu) return;
      setDenemeOnay(null);
      // Bu hafta önbellekte duruyor; tazelemeden önce düşür.
      clearWeekCache();
      await yukle(true);
      // Bakiye sunucuda değişti.
      onChanged?.();
    } catch (error) {
      hataGoster(error, "Deneme dersi işaretlenemedi");
    } finally {
      setIsleniyor(false);
    }
  };

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
        ogrenci: l.tur === "deneme" ? `${l.student_name} (deneme)` : l.student_name,
        dersNo: l.tur === "deneme" ? null : l.lesson_number,
        tamamlandi: l.status === "completed",
        deneme: l.tur === "deneme",
        tasindi: Boolean(l.original_date) || l.is_manual_override,
      });
    }
    kutular.forEach((g) => g.sort((a, b) => a.baslangic.localeCompare(b.baslangic)));
    return kutular;
  }, [dersler, haftaBasi]);

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
            {haftaFarki === 0 ? (
              "Bu hafta"
            ) : (
              /* Başka bir haftadayken "Bu haftaya dön" tam genişlikte ayrı
                 bir düğme satırıydı; bu yazının kendisi dönüş bağlantısı. */
              <button
                type="button"
                className="font-bold underline underline-offset-2"
                style={{ color: "var(--ewd-accent)" }}
                onClick={() => setHaftaFarki(0)}
              >
                {haftaFarki < 0 ? `${-haftaFarki} hafta önce` : `${haftaFarki} hafta sonra`} · bu haftaya dön
              </button>
            )}
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
                    const Etiket = ders.deneme ? "button" : "div";
                    return (
                      <li key={ders.id}>
                        {/* Yalnızca deneme dersleri tıklanabilir (bkz. dosya
                            başlığı); paket dersleri ray üzerinden sırayla. */}
                        <Etiket
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left"
                          style={{ background: "var(--ewd-surface-3)" }}
                          {...(ders.deneme
                            ? {
                                type: "button" as const,
                                onClick: () => setDenemeOnay(ders),
                                "aria-label": `${ders.ogrenci}, ${formatTime(ders.baslangic)} — ${
                                  ders.tamamlandi ? "işlendi, geri al" : "işlendi olarak işaretle"
                                }`,
                              }
                            : {})}
                        >
                        {/* Saat bir kez, solda: başlangıç üstte, bitiş altında.
                            Eskiden başlangıç hem burada hem alt satırda
                            yazıyordu. Sabit genişlik satırları hizalı tutar. */}
                        <span className="flex w-[42px] shrink-0 flex-col leading-tight tabular-nums">
                          <span className="text-[13px] font-black" style={{ color: "var(--ewd-on-surface)" }}>
                            {formatTime(ders.baslangic)}
                          </span>
                          <span className="text-[11px] font-semibold" style={{ color: "var(--ewd-on-surface-faint)" }}>
                            {formatTime(ders.bitis)}
                          </span>
                        </span>

                        {/* Durumlar sağda üç ayrı rozetti ve dar ekranda alt
                            alta kayıp satırı uzatıyordu; artık adın altında
                            düz, renkli sözcükler. */}
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
                          <span className="truncate text-[12px] font-semibold" style={{ color: "var(--ewd-on-surface-faint)" }}>
                            {/* "deneme" burada yazılmaz: ad zaten "(deneme)"
                                taşıyor, iki kez söylemek satırı şişiriyordu. */}
                            {[
                              ders.dersNo ? `${ders.dersNo}. ders` : null,
                              ders.tasindi ? "taşındı" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {ders.tamamlandi && (
                              <span style={{ color: "var(--ewd-green-ink)" }}>
                                {ders.dersNo || ders.tasindi ? " · " : ""}işlendi
                              </span>
                            )}
                          </span>
                        </span>

                        {/* Deneme satırında ne yapılacağını söyleyen tek işaret. */}
                        {ders.deneme && (
                          <span
                            className="shrink-0 whitespace-nowrap text-[11px] font-bold"
                            style={{ color: ders.tamamlandi ? "var(--ewd-on-surface-faint)" : "var(--ewd-purple)" }}
                          >
                            {ders.tamamlandi ? "geri al" : "işaretle"}
                          </span>
                        )}
                        </Etiket>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!denemeOnay} onOpenChange={(a) => !a && !isleniyor && setDenemeOnay(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {denemeOnay?.tamamlandi ? "Deneme dersini geri al" : "Deneme dersini işlendi say"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {denemeOnay && (
                <>
                  {denemeOnay.ogrenci} · {formatTime(denemeOnay.baslangic)}–{formatTime(denemeOnay.bitis)}
                  {denemeOnay.tamamlandi
                    ? " dersi işlenmemiş sayılacak ve süresi bakiyenden düşülecek."
                    : " dersi işlendi olarak kaydedilecek ve süresi bakiyene eklenecek."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isleniyor}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={isleniyor}
              onClick={(e) => {
                // Radix varsayılan olarak kapatır; istek bitene kadar açık kalsın.
                e.preventDefault();
                denemeIsaretle();
              }}
            >
              {isleniyor ? "Kaydediliyor…" : denemeOnay?.tamamlandi ? "Geri al" : "İşlendi say"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
