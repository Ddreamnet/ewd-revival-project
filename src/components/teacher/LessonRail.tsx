import { useMemo, useState } from "react";
import { format } from "date-fns";
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
import { useToast } from "@/hooks/use-toast";
import { ProgressBar } from "@/components/panel/PanelBits";
import { completeLesson, undoCompleteLesson } from "@/lib/lessonService";
import { parseLocalDate } from "@/lib/lessonTypes";
import { railColumns } from "@/lib/panelFormat";
import {
  lastCompletedOf,
  nextCompletableOf,
  type PanelLesson,
  type PanelStudent,
} from "@/hooks/useTeacherPanel";

interface LessonRailProps {
  student: PanelStudent;
  teacherId: string;
  /** Bir dersin durumu değişince paneli iyimser günceller. */
  onLessonToggled: (lessonId: string, completed: boolean) => void;
  /** Sunucudan tazeleme (bakiye de değişiyor). */
  onRefresh: () => void;
}

/**
 * Paket ders rayı — 12 kutu.
 *
 * Tasarımda köşedeki 12'lik sayaç tam genişlikte bir raya dönüştü; sıradaki
 * ders görsel olarak işaretli (mor çerçeve + halka + sarı "SIRADAKİ" etiketi).
 * Ayrı bir "Dersi işle" butonu yok: sıradaki kutuya basmak dersi işler,
 * son işlenene basmak geri alır — sunucudaki sıralı işaretleme kuralıyla aynı.
 */
export function LessonRail({ student, teacherId, onLessonToggled, onRefresh }: LessonRailProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<{ lesson: PanelLesson; mode: "do" | "undo" } | null>(null);
  const [busy, setBusy] = useState(false);

  const nextId = useMemo(() => nextCompletableOf(student)?.id ?? null, [student]);
  const lastDoneId = useMemo(() => lastCompletedOf(student)?.id ?? null, [student]);

  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const { lesson, mode } = pending;
    try {
      const result =
        mode === "do"
          ? await completeLesson(lesson.id, teacherId)
          : await undoCompleteLesson(lesson.id, teacherId);

      if (!result.success) {
        toast({
          title: "Hata",
          description: result.error || (mode === "do" ? "Ders işaretlenemedi" : "Ders geri alınamadı"),
          variant: "destructive",
        });
        return;
      }

      onLessonToggled(lesson.id, mode === "do");
      toast({
        title: "Başarılı",
        description:
          mode === "do"
            ? `Ders işlendi olarak işaretlendi (${format(parseLocalDate(lesson.date), "dd.MM")})`
            : "Son ders geri alındı",
      });
      // Bakiye sunucuda değişti — arkada tazele.
      onRefresh();
    } catch (error) {
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "İşlem tamamlanamadı",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  if (student.lessons.length === 0) {
    return (
      <div className="pnl-card--sunk p-4 text-center text-[13px] font-medium" style={{ color: "var(--ewd-on-surface-soft)" }}>
        Bu öğrenci için henüz ders planlanmamış.
      </div>
    );
  }

  return (
    <>
      <div className="pnl-card--sunk p-4 md:px-5">
        <div className="pb-3.5 lg:hidden">
          <ProgressBar
            value={student.completedCount}
            max={student.totalCount}
            label={`${student.completedCount} / ${student.totalCount} ders`}
          />
        </div>

        <ul
          className="pnl-rail"
          aria-label="Paket dersleri"
          style={
            {
              // Masaüstünde geniş sütun var: tasarımdaki gibi tek sıra.
              "--pnl-rail-cols": Math.min(student.lessons.length, 12),
              // Dar ekranda paket dengeli bölünsün (8 ders → 4'er iki sıra).
              "--pnl-rail-cols-sm": railColumns(student.lessons.length),
            } as React.CSSProperties
          }
        >
          {student.lessons.map((lesson) => {
            const isNext = lesson.id === nextId;
            const isUndoable = lesson.completed && lesson.id === lastDoneId;
            const clickable = isNext || isUndoable;
            const state = lesson.completed ? "done" : isNext ? "next" : "todo";

            return (
              <li key={lesson.id} className="contents">
                <button
                  type="button"
                  className="pnl-lesson"
                  data-state={state}
                  data-clickable={clickable}
                  data-moved={lesson.moved}
                  disabled={!clickable || busy}
                  onClick={() => setPending({ lesson, mode: lesson.completed ? "undo" : "do" })}
                  title={
                    isUndoable
                      ? `Ders ${lesson.number} — geri al`
                      : `Ders ${lesson.number} · ${lesson.start}–${lesson.end}`
                  }
                  aria-label={
                    `Ders ${lesson.number}, ${format(parseLocalDate(lesson.date), "dd.MM")}, ` +
                    (lesson.completed ? "işlendi" : "planlandı") +
                    (isNext ? ", sıradaki" : "")
                  }
                >
                  {isNext && <span className="pnl-tag pnl-tag--next mb-0.5">Sıradaki</span>}
                  <span className="pnl-lesson__box">{lesson.number}</span>
                  <span className="pnl-lesson__date">
                    {format(parseLocalDate(lesson.date), "dd.MM")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.mode === "do" ? "Dersi İşaretle" : "Son Dersi Geri Al"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.mode === "do"
                ? `${student.name} için sıradaki dersi işlendi olarak işaretlemek istiyor musunuz?`
                : `${student.name} için son işlenen dersi geri almak istiyor musunuz? Öğretmen bakiyesi de düzeltilecektir.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={busy}>
              {pending?.mode === "do" ? "Onayla" : "Geri Al"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
