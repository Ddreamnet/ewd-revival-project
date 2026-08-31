import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const QUESTION_KEYS = ["duration", "freeTrial", "platform", "lessonType", "login"] as const;

/** Sık sorulan sorular — pembe blok, yıldız dokusu, tek açılır satır listesi. */
export function FAQSection() {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState<number>(0);

  return (
    <section
      id="faq"
      className="scroll-section relative overflow-hidden px-5 py-20 sm:px-8 md:py-24"
      style={{ background: "var(--ewd-pink-soft)" }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{ backgroundImage: "url(/ewd/pat/tile-star-pink.png)", backgroundSize: "300px" }}
        aria-hidden="true"
      />
      <span className="ewd-scallop-t" style={{ ["--scallop" as string]: "#FBF5FF" }} aria-hidden="true" />
      <span className="ewd-scallop-b" style={{ ["--scallop" as string]: "#FFF8EF" }} aria-hidden="true" />

      <div className="relative mx-auto flex max-w-[880px] flex-col items-center gap-2.5">
        <h2 className="ewd-h2 text-center">{t.faq.title[language]}</h2>
        <p className="mb-6 text-center text-[15px] font-semibold text-[#9D4368] sm:text-[16px]">
          {t.faq.lead[language]}
        </p>

        <div
          className="flex w-full flex-col gap-3 rounded-[28px] border-[3px] p-4 sm:rounded-[36px] sm:p-[22px]"
          style={{
            background: "#FFFDF8",
            borderColor: "#F7B9D3",
            boxShadow: "0 26px 40px -24px rgba(190,24,93,0.4)",
          }}
        >
          {QUESTION_KEYS.map((key, index) => {
            const isOpen = open === index;
            const question = t.faq.questions[key];
            return (
              <div
                key={key}
                className="rounded-[20px] transition-colors sm:rounded-[24px]"
                style={{ background: isOpen ? "#FFE7F1" : "var(--ewd-pink-tint)" }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
                >
                  <span className="text-[16px] font-bold text-[#2E1065] sm:text-[18px]">
                    {question.question[language]}
                  </span>
                  <span
                    className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-[22px] font-bold leading-none text-[#FFF8EF] transition-colors"
                    style={{ background: isOpen ? "var(--ewd-purple)" : "var(--ewd-pink)" }}
                    aria-hidden="true"
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <p className="ewd-lead px-5 pb-5 pr-14 sm:px-6 sm:pb-6">{question.answer[language]}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
