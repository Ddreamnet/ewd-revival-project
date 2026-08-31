import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ResetCountdown } from "@/components/words/ResetCountdown";
import { WordBoard } from "@/components/words/WordBoard";

/**
 * Landing'in "Günün Kelimeleri" bölümü — sayfa açılışında görünür.
 * Üç kart, yenilenme sayacı ve seviye/konu ile rastgele çekim şeridi.
 */
export function DailyWordsSection() {
  const { language, t } = useLanguage();

  return (
    <section
      id="words"
      className="scroll-section relative overflow-hidden px-5 py-20 sm:px-8 md:py-24"
      style={{ background: "#F7ECFF" }}
    >
      {/* Yıldız dokusu + üstte tarak kenar */}
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{ backgroundImage: "url(/ewd/pat/tile-star-purple.png)", backgroundSize: "300px" }}
        aria-hidden="true"
      />
      <span className="ewd-scallop-t" style={{ ["--scallop" as string]: "#FFF8EF" }} aria-hidden="true" />

      <div className="relative mx-auto max-w-[1180px]">
        <div className="flex flex-col items-start gap-8 pb-10 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col items-start gap-2">
            <span className="ewd-label rounded-full bg-[#EC4899] px-5 py-2.5 text-white">
              {t.words.badge[language]}
            </span>
            <h2 className="ewd-h2 mt-2">{t.words.title[language]}</h2>
            <p className="ewd-lead max-w-[520px]">{t.words.lead[language]}</p>
            <Link
              to="/gunun-kelimeleri"
              className="mt-3 inline-flex items-center gap-2 text-[15px] font-extrabold text-[#6D28D9] underline-offset-4 hover:underline"
            >
              {t.words.seeAll[language]}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <ResetCountdown className="shrink-0" />
        </div>

        <WordBoard />
      </div>
    </section>
  );
}
