import { useEffect } from "react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Footer } from "@/components/landing/Footer";
import { ResetCountdown } from "@/components/words/ResetCountdown";
import { WordBoard } from "@/components/words/WordBoard";
import { useLanguage } from "@/contexts/LanguageContext";
import { EN_WORDS, FR_WORDS, LEVELS } from "@/lib/words";

/** Günün Kelimeleri sekmesi — landing bölümünün geniş hâli. */
export default function WordsPage() {
  const { language, t } = useLanguage();

  useEffect(() => {
    const previous = document.title;
    document.title = `${t.words.title[language]} · English with Dilara`;
    // Başka bir rotaya geçince başlık geride kalmasın.
    return () => {
      document.title = previous;
    };
  }, [language, t]);

  const totalWords = EN_WORDS.length + FR_WORDS.length;

  return (
    <div className="landing-body ewd-light min-h-screen">
      <LandingHeader />

      <main>
        <section
          className="relative overflow-hidden px-5 pb-16 pt-12 sm:px-8 md:pb-20 md:pt-16"
          style={{ background: "#F7ECFF" }}
        >
          <span
            className="pointer-events-none absolute inset-0 opacity-[0.22]"
            style={{ backgroundImage: "url(/ewd/pat/tile-star-purple.png)", backgroundSize: "300px" }}
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-[1180px]">
            <div className="flex flex-col items-start gap-8 pb-10 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col items-start gap-2">
                <span className="ewd-label rounded-full bg-[#EC4899] px-5 py-2.5 text-white">
                  {t.words.badge[language]}
                </span>
                <h1 className="ewd-h2 mt-2">{t.words.title[language]}</h1>
                <p className="ewd-lead max-w-[560px]">{t.words.pageLead[language]}</p>

                {/* Bankanın kapsamı — seviye aralığı ve toplam kelime */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {LEVELS.map((lvl) => (
                    <span
                      key={lvl}
                      className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold text-[#6D28D9]"
                      style={{ borderColor: "var(--ewd-lilac-line)" }}
                    >
                      {lvl}
                    </span>
                  ))}
                  <span className="text-[13px] font-semibold text-[#6B5B7B]">· {totalWords}+</span>
                </div>
              </div>

              <ResetCountdown className="shrink-0" />
            </div>

            <WordBoard />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
