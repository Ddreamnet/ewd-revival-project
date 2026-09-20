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

      {/* Üç satırdı: ad, altında İKİ ÇİP ("Pazar 14:00", "Perşembe ✓")
          kendi satırında, en altta ilerleme çubuğu. Çipler 8/13px dolgulu
          birer hap olduğu için satır ~44px tutuyordu. Şimdi sıradaki ve son
          ders adın altında düz bir satır — avatarın yanında durduğu için
          kartı uzatmıyor. */}
      <div className="pointer-events-none relative z-10 flex items-center gap-3">
        <Avatar name={student.name} tone={tone} />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="pnl-student__name truncate">{student.name}</span>
            {hasLessonToday && <span className="pnl-tag pnl-tag--today">Bugün</span>}
          </div>
          <span
            className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold"
            style={{ color: "var(--ewd-on-surface-faint)" }}
          >
            {next ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: tone === "pink" ? "var(--ewd-pink)" : "var(--ewd-green)" }}
                />
                <span className="shrink-0" style={{ color: "var(--ewd-on-surface)" }}>
                  {getDayName(parseLocalDate(next.date).getDay())} {next.start}
                </span>
              </>
            ) : (
              <span>Planlanmış ders yok</span>
            )}
            {past.map((day, i) => (
              <span key={`${day}-${i}`} className="flex min-w-0 items-center gap-1 truncate">
                <span aria-hidden="true">·</span>
                {day}
                <Check className="h-3 w-3 shrink-0" aria-label="işlendi" />
              </span>
            ))}
          </span>
        </div>

        <ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--ewd-muted-3)" }} aria-hidden="true" />
      </div>

      <div className="pointer-events-none relative z-10 mt-2.5">
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
