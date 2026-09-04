import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LOCALES } from "@/lib/translations";
import { WordCard } from "./WordCard";
import { WordControls } from "./WordControls";
import { useDailyWords } from "./useDailyWords";

interface WordBoardProps {
  className?: string;
}

/**
 * Üç kartlık pano + kontrol şeridi. Hem landing bölümü hem de
 * "Günün Kelimeleri" sayfası bunu kullanır.
 */
export function WordBoard({ className = "" }: WordBoardProps) {
  const { language, t } = useLanguage();
  const { controls, setControls, entries, isEmpty, dayOffset, dayDate, canGoPrev, canGoNext, goPrevDay, goNextDay } =
    useDailyWords();

  // Bugün ve dün adıyla anılır; daha eski günler tarihiyle yazılır.
  const dayLabel =
    dayOffset === 0
      ? t.words.todayBadge[language]
      : dayOffset === -1
        ? t.words.yesterdayBadge[language]
        : dayDate.toLocaleDateString(LOCALES[language], { day: "numeric", month: "long" });

  return (
    <div className={className}>
      <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={goPrevDay}
          disabled={!canGoPrev}
          aria-label={t.words.prevDay[language]}
          className="ewd-dayarrow"
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
        </button>

        <span
          className="rounded-full px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em]"
          style={
            dayOffset === 0
              ? { background: "var(--ewd-purple)", color: "#fff" }
              : { background: "var(--ewd-lilac-tint)", color: "#6D28D9" }
          }
        >
          {dayLabel}
        </span>

        <button
          type="button"
          onClick={goNextDay}
          disabled={!canGoNext}
          aria-label={t.words.nextDay[language]}
          className="ewd-dayarrow"
        >
          <ChevronRight className="h-[18px] w-[18px]" />
        </button>
      </div>

      {isEmpty ? (
        <p
          className="rounded-[26px] border-2 border-dashed px-6 py-12 text-center text-[15px] font-semibold"
          style={{ borderColor: "var(--ewd-lilac-line)", color: "var(--ewd-body-soft)" }}
        >
          {t.words.noMatch[language]}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, i) => (
            <div
              key={`${entry.id}-${dayOffset}`}
              className="animate-ewd-card-in"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <WordCard entry={entry} wordLanguage={controls.wordLanguage} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-7">
        <WordControls value={controls} onChange={setControls} />
      </div>
    </div>
  );
}
