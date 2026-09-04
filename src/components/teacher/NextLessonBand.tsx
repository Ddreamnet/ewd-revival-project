import { memo } from "react";
import { CountBox, CountStrip } from "@/components/panel/PanelBits";
import { ZoomButton } from "@/components/panel/ZoomButton";
import type { TeacherPanelSummary } from "@/hooks/useTeacherPanel";

/** "42 DK SONRA" / "2 SA 10 DK SONRA" / "ŞİMDİ" */
function untilLabel(minutes: number): string {
  if (minutes <= 0) return "ŞİMDİ";
  if (minutes < 60) return `${minutes} DK SONRA`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} SA ${rest} DK SONRA` : `${hours} SAAT SONRA`;
  const days = Math.round(hours / 24);
  return `${days} GÜN SONRA`;
}

interface NextLessonBandProps {
  summary: TeacherPanelSummary;
}

/**
 * Sıradaki ders bandı — panelin en üstündeki tek eylemli blok.
 *
 * Tasarımın çözdüğü kullanılabilirlik sorunu: öğretmenin ders başında
 * yapacağı tek iş derse bağlanmak; bu yüzden blokta başka eylem yok.
 * Zoom düğmesi mobilde de saatin yanında duruyor: alta alındığında blok
 * tek başına ~170px kaplıyor ve ekranın üçte birini yiyordu.
 */
export const NextLessonBand = memo(function NextLessonBand({ summary }: NextLessonBandProps) {
  const next = summary.nextLesson;

  return (
    <section className="pnl-band" aria-label="Sıradaki ders">
      <div className="pnl-wrap grid grid-cols-[minmax(0,1fr)] gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_178px_178px] lg:py-5">
        <div className="pnl-next flex items-center gap-3 lg:gap-6">
          {next ? (
            <>
              <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="pnl-next__label">
                  SIRADAKİ DERS · {untilLabel(next.minutesUntil)}
                </span>
                <span className="pnl-next__title">
                  <span className="lg:hidden">
                    <span className="block truncate">{next.student.name}</span>
                    {next.lesson.start}–{next.lesson.end}
                  </span>
                  <span className="hidden lg:inline">
                    {next.student.name} · {next.lesson.start}–{next.lesson.end}
                  </span>
                </span>
              </div>

              {next.student.zoomLink ? (
                <ZoomButton
                  href={next.student.zoomLink}
                  compact
                  label={
                    <>
                      <span className="lg:hidden">Zoom</span>
                      <span className="hidden lg:inline">Zoom'a Bağlan</span>
                    </>
                  }
                  className="relative shrink-0 lg:min-h-[48px] lg:px-5 lg:text-[14px]"
                />
              ) : (
                <span
                  className="relative shrink-0 rounded-full px-3 py-2 text-center text-[12px] font-bold leading-tight lg:px-4 lg:py-3 lg:text-[13px]"
                  style={{ background: "rgb(255 248 239 / 0.16)", color: "var(--ewd-on-purple-soft)" }}
                >
                  <span className="lg:hidden">Zoom yok</span>
                  <span className="hidden lg:inline">Zoom bağlantısı tanımlı değil</span>
                </span>
              )}
            </>
          ) : (
            <div className="relative flex flex-col gap-1.5">
              <span className="pnl-next__label">SIRADAKİ DERS</span>
              <span className="pnl-next__title">Planlanmış ders yok</span>
              <span className="relative text-[13px] font-medium" style={{ color: "var(--ewd-on-purple-soft)" }}>
                Ders programı tanımlandığında burada görünür.
              </span>
            </div>
          )}
        </div>

        {/* Mobilde tek satırlık şerit, masaüstünde tasarımdaki iki sayaç
            kartı: kartlar telefonda bandı 316px'e çıkarıyordu. */}
        <div className="lg:hidden">
          <CountStrip
            items={[
              { value: summary.todayCount, label: "ders bugün" },
              { value: summary.weekCount, label: "bu hafta" },
            ]}
          />
        </div>
        <div className="hidden lg:contents">
          <CountBox value={summary.todayCount} label="Bugünkü ders" />
          <CountBox value={summary.weekCount} label="Bu hafta" tone="yellow" />
        </div>
      </div>
    </section>
  );
});
