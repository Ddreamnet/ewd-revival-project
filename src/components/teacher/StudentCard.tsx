import { memo } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Avatar, ProgressBar } from "@/components/panel/PanelBits";
import { toneForName } from "@/lib/panelFormat";
import { getDayName, parseLocalDate } from "@/lib/lessonTypes";
import { nextLessonOf, pastLessonDays, type PanelStudent } from "@/hooks/useTeacherPanel";

interface StudentCardProps {
  student: PanelStudent;
  active: boolean;
  hasLessonToday: boolean;
  now: number;
  onSelect: (student: PanelStudent) => void;
}

/**
 * Öğrenci rayındaki kart.
 *
 * Eski panelde ders satırları üstü çizili kırmızı metinlerdi; tasarım bunu
 * yeşil "sıradaki" çipi + gri geçmiş çipleri + paket ilerleme çubuğu ile
 * değiştirdi. Kartın tamamı tıklanabilir (gerilmiş buton); ☰ ayrı bir eylem.
 */
export const StudentCard = memo(function StudentCard({
  student,
  active,
  hasLessonToday,
  now,
  onSelect,
}: StudentCardProps) {
  const tone = toneForName(student.name);
  const next = nextLessonOf(student, now);
  // Tek geçmiş çipi yeter: ilerleme çubuğu zaten toplamı söylüyor, iki çip
  // dar ekranda ikinci satıra sarıp kartı uzatıyordu.
  const past = pastLessonDays(student, 1);

  return (
    <div className="pnl-student relative" data-active={active}>
      {/* Kartın tamamını kaplayan asıl eylem — 48px'in çok üstünde bir hedef. */}
      <button
        type="button"
        className="pnl-hit"
        aria-label={`${student.name} — öğrenci detayını aç`}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(student)}
      />

      <div className="pointer-events-none relative z-10 flex items-start gap-3.5">
        <Avatar name={student.name} tone={tone} />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="pnl-student__name truncate">{student.name}</span>
            {hasLessonToday && <span className="pnl-tag pnl-tag--today">Bugün</span>}
          </div>
        </div>

        <ChevronRight
          className="mt-2.5 h-5 w-5 shrink-0"
          style={{ color: "var(--ewd-muted-3)" }}
          aria-hidden="true"
        />
      </div>

      <div className="pointer-events-none relative z-10 flex flex-wrap items-center gap-2 pb-3 pt-3.5">
        {next ? (
          <span className={tone === "pink" ? "pnl-chip pnl-chip--next-pink" : "pnl-chip pnl-chip--next"}>
            <span
              className="pnl-chip__dot"
              style={{ background: tone === "pink" ? "var(--ewd-pink)" : "var(--ewd-green)" }}
            />
            {getDayName(parseLocalDate(next.date).getDay())} {next.start}
          </span>
        ) : (
          <span className="pnl-chip">Planlanmış ders yok</span>
        )}

        {past.map((day, i) => (
          <span key={`${day}-${i}`} className="pnl-chip">
            {day}
            <Check className="h-3 w-3" aria-hidden="true" />
          </span>
        ))}
      </div>

      <div className="pointer-events-none relative z-10">
        <ProgressBar
          value={student.completedCount}
          max={student.totalCount}
          tone={tone === "pink" ? "pink" : "purple"}
          label={`${student.completedCount} / ${student.totalCount} ders`}
        />
      </div>
    </div>
  );
});
