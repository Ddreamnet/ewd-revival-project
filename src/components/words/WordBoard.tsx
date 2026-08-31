import { useLanguage } from "@/contexts/LanguageContext";
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
  const { controls, setControls, entries, isRandom, isEmpty, shuffle, reset } = useDailyWords();

  return (
    <div className={className}>
      <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
        <span
          className="rounded-full px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em]"
          style={
            isRandom
              ? { background: "var(--ewd-pink)", color: "#fff" }
              : { background: "var(--ewd-purple)", color: "#fff" }
          }
        >
          {isRandom ? t.words.randomBadge[language] : t.words.todayBadge[language]}
        </span>
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
              key={`${entry.id}-${isRandom}`}
              className="animate-ewd-card-in"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <WordCard entry={entry} wordLanguage={controls.wordLanguage} index={i} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-7">
        <WordControls
          value={controls}
          onChange={setControls}
          onShuffle={shuffle}
          onReset={reset}
          isRandom={isRandom}
        />
      </div>
    </div>
  );
}
