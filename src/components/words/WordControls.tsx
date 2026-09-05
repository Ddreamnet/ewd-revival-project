import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LEVELS, type Level, type WordLanguage } from "@/lib/words";
import { WORD_LANGUAGE_LIST, WORD_LANGUAGE_META, wordLanguageName } from "@/lib/words/wordLanguages";

export interface WordControlsValue {
  wordLanguage: WordLanguage;
  level: Level | "all";
}

interface WordControlsProps {
  value: WordControlsValue;
  onChange: (next: WordControlsValue) => void;
}

/**
 * Kelime kartlarının altındaki tek satırlık kontrol şeridi: öğrenilecek dil ve
 * seviye. Seçili seviyeye yeniden basmak tüm seviyelere döndürür.
 *
 * Dil sayısı altıya çıktığı için yan yana dizilen düğmeler yerine açılır bir
 * liste kullanılıyor; liste, üst menüdeki dil anahtarıyla aynı görünümü
 * paylaşır (`.ewd-langmenu` / `.ewd-langitem`) ki sayfada iki ayrı menü dili
 * konuşmasın.
 */
export function WordControls({ value, onChange }: WordControlsProps) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);

  const set = (patch: Partial<WordControlsValue>) => onChange({ ...value, ...patch });
  const current = WORD_LANGUAGE_META[value.wordLanguage];

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 rounded-[26px] border-2 px-4 py-3.5 sm:px-5"
      style={{ background: "var(--ewd-cream-hi)", borderColor: "var(--ewd-lilac-hair)" }}
    >
      {/* Öğrenilecek dil — açılır liste */}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="ewd-wordlang" aria-label={t.words.langPickerLabel[language]}>
            <img src={current.flagIcon} alt="" aria-hidden="true" className="ewd-wordlang__flag" />
            <span className="ewd-wordlang__name">{wordLanguageName(t, current.code, language)}</span>
            <span className="ewd-wordlang__code" aria-hidden="true">
              {current.label}
            </span>
            <ChevronDown className="ewd-wordlang__chev" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="center" sideOffset={10} className="ewd-langmenu z-[60]">
          <p className="ewd-wordlang__heading">{t.words.langLabel[language]}</p>
          {WORD_LANGUAGE_LIST.map((lang) => {
            const active = value.wordLanguage === lang.code;
            return (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => set({ wordLanguage: lang.code })}
                data-active={active}
                className="ewd-langitem"
              >
                <img src={lang.flagIcon} alt="" aria-hidden="true" className="ewd-langitem__flag" />
                {wordLanguageName(t, lang.code, language)}
                {active && <Check className="ewd-wordlang__check" aria-hidden="true" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="hidden h-6 w-px sm:block" style={{ background: "var(--ewd-lilac-hair)" }} />

      {/* Seviye — A1'den C2'ye; seçiliye tekrar basınca filtre kalkar */}
      <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label={t.words.level[language]}>
        {LEVELS.map((lvl) => {
          const active = value.level === lvl;
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => set({ level: active ? "all" : lvl })}
              aria-pressed={active}
              className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full border-2 px-3 text-[12px] font-extrabold transition-colors"
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
              {lvl}
            </button>
          );
        })}
      </div>
    </div>
  );
}
