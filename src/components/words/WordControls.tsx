import { Shuffle, CalendarDays } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CATEGORIES, LEVELS, type Category, type Level, type WordLanguage } from "@/lib/words";

export interface WordControlsValue {
  wordLanguage: WordLanguage;
  level: Level | "all";
  category: Category | "all";
}

interface WordControlsProps {
  value: WordControlsValue;
  onChange: (next: WordControlsValue) => void;
  /** Rastgele çekim yapıldığında çağrılır. */
  onShuffle: () => void;
  /** Rastgele moddayken günün kelimelerine dönmek için. */
  onReset?: () => void;
  isRandom: boolean;
}

/**
 * Kelime kartlarının üstündeki tek satırlık kontrol şeridi:
 * dil · seviye · konu · rastgele çek. Landing'de de sayfada da aynısı kullanılır.
 */
export function WordControls({ value, onChange, onShuffle, onReset, isRandom }: WordControlsProps) {
  const { language, t } = useLanguage();

  const set = (patch: Partial<WordControlsValue>) => onChange({ ...value, ...patch });

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 rounded-[26px] border-2 px-4 py-3.5 sm:px-5"
      style={{ background: "var(--ewd-cream-hi)", borderColor: "var(--ewd-lilac-hair)" }}
    >
      {/* Kelime dili — İngilizce / Fransızca */}
      <div
        className="flex items-center gap-1 rounded-full p-1"
        style={{ background: "var(--ewd-lilac-tint)" }}
        role="group"
        aria-label={t.words.langLabel[language]}
      >
        {(["en", "fr"] as const).map((code) => {
          const active = value.wordLanguage === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => set({ wordLanguage: code })}
              aria-pressed={active}
              className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em] transition-colors"
              style={
                active
                  ? { background: "var(--ewd-purple)", color: "#fff" }
                  : { color: "var(--ewd-body-soft)" }
              }
            >
              {code === "en" ? "EN" : "FR"}
            </button>
          );
        })}
      </div>

      <span className="hidden h-6 w-px sm:block" style={{ background: "var(--ewd-lilac-hair)" }} />

      {/* Seviye — A1'den C2'ye */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.words.level[language]}>
        <LevelChip
          label={t.words.allLevels[language]}
          active={value.level === "all"}
          onClick={() => set({ level: "all" })}
        />
        {LEVELS.map((lvl) => (
          <LevelChip key={lvl} label={lvl} active={value.level === lvl} onClick={() => set({ level: lvl })} />
        ))}
      </div>

      <span className="hidden h-6 w-px sm:block" style={{ background: "var(--ewd-lilac-hair)" }} />

      {/* Konu */}
      <label className="flex items-center gap-2">
        <span className="sr-only">{t.words.category[language]}</span>
        <select
          value={value.category}
          onChange={(e) => set({ category: e.target.value as Category | "all" })}
          className="cursor-pointer rounded-full border-2 px-3.5 py-2 text-[13px] font-bold outline-none transition-colors"
          style={{
            background: "var(--ewd-cream)",
            borderColor: "var(--ewd-lilac-hair)",
            color: "var(--ewd-body-soft)",
          }}
        >
          <option value="all">{t.words.allCategories[language]}</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t.words.categories[cat][language]}
            </option>
          ))}
        </select>
      </label>

      {/* Eylem */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onShuffle} className="ewd-btn ewd-btn--purple ewd-btn--sm">
          <Shuffle className="h-4 w-4" />
          {t.words.shuffle[language]}
        </button>
        {isRandom && onReset && (
          <button type="button" onClick={onReset} className="ewd-btn ewd-btn--outline ewd-btn--sm">
            <CalendarDays className="h-4 w-4" />
            {t.words.backToToday[language]}
          </button>
        )}
      </div>
    </div>
  );
}

function LevelChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors"
      style={
        active
          ? { background: "var(--ewd-pink)", borderColor: "var(--ewd-pink)", color: "#fff" }
          : {
              background: "transparent",
              borderColor: "var(--ewd-lilac-hair)",
              color: "var(--ewd-body-soft)",
            }
      }
    >
      {label}
    </button>
  );
}
