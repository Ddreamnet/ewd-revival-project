import { useId, useState } from "react";
import { Volume2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { WordEntry, WordLanguage } from "@/lib/words";
import { artFor, toneFor } from "./wordVisuals";

interface WordCardProps {
  entry: WordEntry;
  /** Kelimenin dili — örnek cümlenin çevirisi buna göre gizlenir. */
  wordLanguage: WordLanguage;
  /** Renk ritmini belirler (mor → pembe → sarı). */
  index: number;
}

/**
 * Günün kelime kartı. Ön yüzde kelime ve kısa anlamı; dokununca dönüp
 * arka yüzde okunuşu, örnek cümlesi, eş ve zıt anlamlıları gösterir.
 */
export function WordCard({ entry, wordLanguage, index }: WordCardProps) {
  const { language, t } = useLanguage();
  const [flipped, setFlipped] = useState(false);
  const tone = toneFor(index);
  const faceId = useId();

  // Arayüz dili kelimenin diliyle aynıysa cümleyi çevirmenin anlamı yok.
  const exampleTranslation = language === wordLanguage ? undefined : entry.exampleT[language];

  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const speak = () => {
    if (!canSpeak) return;
    const utterance = new SpeechSynthesisUtterance(entry.word.replace(/^(le |la |l'|les )/, ""));
    utterance.lang = wordLanguage === "en" ? "en-GB" : "fr-FR";
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      className="ewd-flip h-[430px] sm:h-[450px] select-none"
      data-flipped={flipped}
      onClick={() => setFlipped((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped((v) => !v);
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={flipped}
      aria-controls={faceId}
      aria-label={`${entry.word} — ${flipped ? t.words.backHint[language] : t.words.flipHint[language]}`}
    >
      <div className="ewd-flip__inner">
        {/* ---------------------------------------------------------- ön yüz */}
        <div
          className="ewd-flip__face rounded-[34px] px-6 pb-6 pt-6 cursor-pointer"
          style={{
            background: tone.bg,
            boxShadow: `0 5px 0 ${tone.base}, 0 28px 40px -22px rgba(46,16,101,0.5)`,
          }}
        >
          {/* Resim paneli — referans kart düzenindeki açık renkli üst blok */}
          <div
            className="relative grid h-[152px] shrink-0 place-items-center overflow-hidden rounded-[24px]"
            style={{ background: tone.panel }}
          >
            <span
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: "url(/ewd/pat/tile-dot-yellow.png)",
                backgroundSize: "88px",
              }}
            />
            <img
              src={artFor(entry.category)}
              alt=""
              loading="lazy"
              className="relative h-[112px] w-auto"
              style={{ filter: "drop-shadow(0 10px 14px rgba(46,16,101,0.22))" }}
            />
          </div>

          <div className="flex flex-1 flex-col items-center pt-5 text-center">
            <span
              className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
              style={{ color: tone.inkSoft }}
            >
              {entry.level} · {t.words.categories[entry.category][language]}
            </span>

            <h3
              className="mt-2 text-[30px] font-black leading-[1.05] tracking-[-0.02em] sm:text-[34px]"
              style={{ color: tone.ink, overflowWrap: "anywhere" }}
            >
              {entry.word}
            </h3>

            <span className="mt-1 text-[13px] font-semibold italic" style={{ color: tone.inkSoft }}>
              {entry.phonetic} · {t.words.pos[entry.pos][language]}
            </span>

            <p
              className="mt-3 line-clamp-3 text-[15px] font-medium leading-[1.5]"
              style={{ color: tone.ink, textWrap: "pretty" }}
            >
              {entry.meaning[language]}
            </p>

            <span
              className="mt-auto inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.1em]"
              style={{ background: tone.panel, color: tone.accent }}
            >
              {t.words.flipHint[language]}
              <span aria-hidden="true">↻</span>
            </span>
          </div>
        </div>

        {/* -------------------------------------------------------- arka yüz */}
        <div
          id={faceId}
          className="ewd-flip__face ewd-flip__face--back cursor-pointer rounded-[34px] px-6 py-6"
          style={{
            background: "#FFFDF8",
            border: `3px solid ${tone.edge}`,
            boxShadow: `0 5px 0 ${tone.base}, 0 28px 40px -22px rgba(46,16,101,0.5)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className="truncate text-[22px] font-black leading-tight tracking-[-0.02em]"
                style={{ color: tone.accent }}
              >
                {entry.word}
              </h3>
              <span className="text-[13px] font-semibold italic text-[#8B7A9E]">{entry.phonetic}</span>
            </div>
            {canSpeak && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  speak();
                }}
                // Aksi hâlde Enter/Space kartı da çevirirdi.
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={t.words.listen[language]}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95"
                style={{ background: tone.wash, color: tone.accent, border: `2px solid ${tone.edge}` }}
              >
                <Volume2 className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <BackBlock label={t.words.meaning[language]} tone={tone}>
              <p className="text-[14px] font-semibold leading-[1.45] text-[#2E1065]">{entry.meaning[language]}</p>
            </BackBlock>

            <BackBlock label={t.words.example[language]} tone={tone}>
              <p className="text-[14px] font-semibold italic leading-[1.45] text-[#2E1065]">“{entry.example}”</p>
              {exampleTranslation && (
                <p className="mt-1 text-[13px] font-medium leading-[1.45] text-[#6B7280]">{exampleTranslation}</p>
              )}
            </BackBlock>

            {entry.synonyms.length > 0 && (
              <BackBlock label={t.words.synonyms[language]} tone={tone}>
                <div className="flex flex-wrap gap-1.5">
                  {entry.synonyms.map((syn) => (
                    <span
                      key={syn}
                      className="rounded-full px-2.5 py-1 text-[12px] font-bold"
                      style={{ background: tone.wash, color: tone.accent }}
                    >
                      {syn}
                    </span>
                  ))}
                </div>
              </BackBlock>
            )}

            {entry.antonym && (
              <BackBlock label={t.words.antonym[language]} tone={tone}>
                <span className="text-[13px] font-bold text-[#DB2777]">{entry.antonym}</span>
              </BackBlock>
            )}
          </div>

          <span className="mt-3 shrink-0 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9A87AC]">
            {t.words.backHint[language]} ↻
          </span>
        </div>
      </div>
    </div>
  );
}

function BackBlock({
  label,
  tone,
  children,
}: {
  label: string;
  tone: { edge: string; accent: string };
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-dotted pl-3" style={{ borderColor: tone.edge }}>
      <span className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: tone.accent }}>
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </div>
  );
}
