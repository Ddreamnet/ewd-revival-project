import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Calendar } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/panel/PanelBits";
import { LessonOverrideDialog } from "@/components/LessonOverrideDialog";
import { clearWeekCache, fetchLessonsForDay, type ActualLesson } from "@/hooks/useScheduleGrid";
import { useMinuteTick } from "@/hooks/usePanelPlatform";
import { formatTime, toDateStr } from "@/lib/lessonTypes";
import { toneForName } from "@/lib/panelFormat";
import { hataGoster } from "@/lib/notify";

/* ------------------------------------------------------------------ */
/* Başlık düğmesi                                                      */
/* ------------------------------------------------------------------ */

/**
 * Takvim ikonu, içinde bugünün günü — telefonun takvim simgesi gibi. Düğmenin
 * ne açtığını yazısız söylüyor.
 */
function TodayGlyph() {
  return (
    <span className="relative grid place-items-center" aria-hidden>
      <Calendar className="h-[22px] w-[22px]" strokeWidth={2.2} />
      <span className="absolute left-0 right-0 top-[9.5px] text-center text-[8.5px] font-black leading-none tabular-nums">
        {new Date().getDate()}
      </span>
    </span>
  );
}

/** Zilin solunda duran düğme: telefonda yuvarlak ikon, masaüstünde etiketli hap. */
export function TodayPlanButton({ onClick }: { onClick: () => void }) {
  return (
    <>
      <button
        type="button"
        className="pnl-iconbtn pnl-iconbtn--sm pnl-iconbtn--soft md:hidden"
        aria-label="Bugünün planı"
        title="Bugünün planı"
        onClick={onClick}
      >
        <TodayGlyph />
      </button>
      <button type="button" className="pnl-btn pnl-btn--soft hidden md:inline-flex" onClick={onClick}>
        <TodayGlyph />
        Bugün
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Plan kartı                                                          */
/* ------------------------------------------------------------------ */

interface TodayPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Açık şubenin öğretmenleri — plan panelin geri kalanıyla aynı kapsamda. */
  teachers: { user_id: string; full_name: string }[];
  /** Öğretmen listesi henüz inmedi: "ders yok" demek için erken. */
  teachersLoading: boolean;
  /** Başlıkta görünen şube adı. */
  branchLabel: string;
  /** Bir dersin tarihi/saati değişti — arkadaki haftalık program da tazelensin. */
  onChanged: () => void;
}

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Adminin "bugünün planı": açık şubedeki bütün öğretmenlerin bugünkü dersleri,
 * saat sırasıyla tek listede.
 *
 * Görünüş öğretmen panelindeki haftalık programın gün kartıyla aynı (saat
 * solda, ad ortada, durum adın altında düz yazı); fark, satırın altında
 * öğretmenin adının da yazması.
 *
 * Yeni bir düzenleme yolu YOK. Satıra dokununca haftalık programdaki derse
 * tıklanınca açılan aynı `LessonOverrideDialog` açılır; tarih, saat, "yapılmadı"
 * ve geri alma oradan, aynı sunucu çağrılarıyla yapılır. Veri de haftalık
 * programın okuduğu fonksiyondan gelir (`useScheduleGrid` → `fetchInstances`).
 */
export function TodayPlanDialog({
  open,
  onOpenChange,
  teachers,
  teachersLoading,
  branchLabel,
  onChanged,
}: TodayPlanDialogProps) {
  const [lessons, setLessons] = useState<ActualLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const now = useMinuteTick();

  // Düzenleme penceresi: ders ile açık/kapalı ayrı tutulur ki kapanış
  // animasyonu boyunca içerik yerinde kalsın (AdminWeeklySchedule ile aynı).
  const [editing, setEditing] = useState<ActualLesson | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const teacherNames = useMemo(() => new Map(teachers.map((t) => [t.user_id, t.full_name])), [teachers]);
  // Dizi her render'da yeni; içeriği değişmedikçe yeniden okumayalım.
  const idsKey = teachers.map((t) => t.user_id).join(",");

  /** Ekrandaki liste hangi gün + öğretmen kümesi için — iskelet yalnızca o değişince. */
  const loadedFor = useRef<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const day = new Date();
    const key = `${toDateStr(day)}|${idsKey}`;
    if (loadedFor.current !== key) setLoading(true);
    const mine = ++seq.current;
    try {
      const rows = await fetchLessonsForDay(idsKey ? idsKey.split(",") : [], day);
      if (mine !== seq.current) return;
      loadedFor.current = key;
      setLessons(rows);
      setFailed(false);
    } catch (error) {
      if (mine !== seq.current) return;
      setFailed(true);
      hataGoster(error, "Bugünün planı yüklenemedi");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [idsKey]);

  useEffect(() => {
    if (open && !teachersLoading) load();
  }, [open, teachersLoading, load]);

  const sorted = useMemo(
    () =>
      [...lessons].sort(
        (a, b) =>
          a.start_time.localeCompare(b.start_time) ||
          (teacherNames.get(a.teacher_id) ?? "").localeCompare(teacherNames.get(b.teacher_id) ?? "", "tr"),
      ),
    [lessons, teacherNames],
  );

  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const busy = loading || teachersLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* animateHeight: iskelet → liste geçişinde kart zıplamasın, büyüsün. */}
        <DialogContent size="md" animateHeight>
          <DialogHeader>
            <DialogTitle>Bugünün planı</DialogTitle>
            <DialogDescription>
              {/* "işlendi" sayısı burada yazmaz: satırlarda yeşille duruyor,
                  burada ise 360px'te açıklamayı ikinci satıra taşırıyordu. */}
              {format(new Date(now), "d MMMM EEEE", { locale: tr })} · {branchLabel}
              {!busy && !failed && sorted.length > 0 && ` · ${sorted.length} ders`}
            </DialogDescription>
          </DialogHeader>

          {busy ? (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Plan yükleniyor">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[54px] animate-pulse rounded-2xl"
                  style={{ background: "var(--ewd-lilac-tint)" }}
                />
              ))}
            </div>
          ) : failed ? (
            <EmptyState title="Plan yüklenemedi" text="Bağlantıyı kontrol edip kartı yeniden açın." />
          ) : sorted.length === 0 ? (
            <EmptyState title="Bugün ders yok" text={`${branchLabel} şubesinde bugüne planlanmış ders bulunmuyor.`} />
          ) : (
            <ul className="flex flex-col gap-2">
              {sorted.map((lesson) => {
                const deneme = lesson.tur === "deneme";
                const name = deneme ? `${lesson.student_name} (deneme)` : lesson.student_name;
                const completed = lesson.status === "completed";
                const moved = Boolean(lesson.original_date) || lesson.is_manual_override;
                const live = nowMin >= minutes(lesson.start_time) && nowMin < minutes(lesson.end_time);
                const tone = toneForName(name);
                const meta = [
                  teacherNames.get(lesson.teacher_id) ?? "Öğretmen",
                  deneme ? null : `${lesson.lesson_number}. ders`,
                  moved ? "taşındı" : null,
                ].filter(Boolean);

                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition-colors"
                      style={{
                        background: live ? "var(--ewd-accent-wash)" : "var(--ewd-surface-3)",
                        borderColor: live ? "var(--ewd-purple)" : "transparent",
                      }}
                      aria-label={`${name}, ${formatTime(lesson.start_time)} — dersi düzenle`}
                      onClick={() => {
                        setEditing(lesson);
                        setEditOpen(true);
                      }}
                    >
                      <span className="flex w-[42px] shrink-0 flex-col leading-tight tabular-nums">
                        <span className="text-[13px] font-black" style={{ color: "var(--ewd-on-surface)" }}>
                          {formatTime(lesson.start_time)}
                        </span>
                        <span className="text-[11px] font-semibold" style={{ color: "var(--ewd-on-surface-faint)" }}>
                          {formatTime(lesson.end_time)}
                        </span>
                      </span>

                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className="truncate text-[14px] font-extrabold"
                          style={{ color: tone === "pink" ? "var(--ewd-pink-ink)" : "var(--ewd-on-lilac)" }}
                        >
                          {name}
                        </span>
                        <span className="truncate text-[12px] font-semibold" style={{ color: "var(--ewd-on-surface-faint)" }}>
                          {meta.join(" · ")}
                          {completed && <span style={{ color: "var(--ewd-green-ink)" }}> · işlendi</span>}
                        </span>
                      </span>

                      {live && <span className="pnl-tag pnl-tag--today shrink-0">şimdi</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <LessonOverrideDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        lesson={editing}
        teacherId={editing?.teacher_id ?? ""}
        onSuccess={() => {
          // Haftalık programın önbelleği de bayatladı; ikisi aynı satırları gösteriyor.
          clearWeekCache();
          load();
          onChanged();
        }}
      />
    </>
  );
}
