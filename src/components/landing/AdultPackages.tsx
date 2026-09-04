import { useLanguage } from "@/contexts/LanguageContext";

const ITEMS = [
  { key: "speaking", icon: "y-konusma.svg" },
  { key: "work", icon: "y-hedef.svg" },
  { key: "skills", icon: "y-kulaklik.svg" },
  { key: "duration", icon: "y-takvim.svg" },
  { key: "everyday", icon: "y-canta.svg" },
  { key: "options", icon: "y-grup.svg" },
] as const;

/** Yetişkin paketi — kareli kâğıt zemin üzerinde tek geniş çerçeveli kart. */
export function AdultPackages() {
  const { language, t } = useLanguage();
  const pack = t.adultPackages.adultPackage;

  const scrollToContact = () => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section
      id="adult-packages"
      className="ewd-grid-paper ewd-bulge-host scroll-section relative px-5 py-20 sm:px-8 md:py-24"
      style={{ backgroundColor: "#FBF5FF", ["--grid" as string]: "#E9DBF7" }}
    >
      {/* Tarak geçişi — kareli zemin üstteki ve alttaki bölüme sarkar. */}
      <span className="ewd-bulge" style={{ ["--bulge" as string]: "#FBF5FF" }} aria-hidden="true">
        <span className="ewd-bulge__tex ewd-grid-paper" style={{ backgroundSize: "34px 34px" }} />
      </span>
      <div className="mx-auto max-w-[1080px]">
        <div className="flex flex-col items-start justify-between gap-6 pb-9 md:flex-row md:items-end md:gap-10">
          <h2 className="ewd-h2 whitespace-pre-line">{t.adultPackages.title[language]}</h2>
          <p
            className="ewd-lead mb-1.5 max-w-[400px] border-l-[3px] border-dotted pl-5"
            style={{ borderColor: "#D6C0F0" }}
          >
            {t.adultPackages.description[language]}
          </p>
        </div>

        <div
          className="relative rounded-[36px] border-4 p-6 sm:rounded-[46px] sm:p-8"
          style={{
            borderColor: "var(--ewd-lilac-line)",
            background: "#FFFDF8",
            boxShadow: "0 30px 44px -24px rgba(46,16,101,0.3)",
          }}
        >
          {/* Sarı bookmark şeridi */}
          <span
            className="absolute left-[54px] top-[-19px] h-[30px] w-[118px]"
            style={{ background: "var(--ewd-yellow)", boxShadow: "0 3px 8px rgba(46,16,101,0.18)" }}
            aria-hidden="true"
          />
          <img
            src="/ewd/assets/art-graduation.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-3 hidden w-[210px] lg:block lg:w-[296px]"
            style={{ filter: "drop-shadow(0 12px 18px rgba(46,16,101,0.16))" }}
          />

          <div className="relative flex max-w-[560px] flex-col gap-4 pt-3.5">
            <div className="flex items-center gap-4">
              <span
                className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full text-[23px] font-black text-white"
                style={{ background: "var(--ewd-purple-deep)" }}
              >
                {pack.number[language]}
              </span>
              <h3 className="ewd-h3 text-[#2E1065]">
                {pack.titleTop[language]}
                <br />
                <span className="text-[#8B5CF6]">{pack.titleBottom[language]}</span>
              </h3>
            </div>

            <div
              className="flex items-center gap-3 self-start rounded-full px-5 py-3"
              style={{ background: "var(--ewd-purple-deep)" }}
            >
              <img src="/ewd/assets/ic/y-bar.svg" alt="" aria-hidden="true" className="w-6" />
              <span className="text-[15px] font-extrabold text-white sm:text-[18px]">{pack.levels[language]}</span>
            </div>
          </div>

          <div className="relative flex items-center gap-4 pb-4 pt-7">
            <span
              className="shrink-0 rounded-full px-5 py-2.5 text-[14px] font-extrabold tracking-[0.04em] sm:text-[16px]"
              style={{ background: "var(--ewd-lilac)", color: "var(--ewd-purple-deep)" }}
            >
              {pack.contents[language]}
            </span>
            <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: "var(--ewd-lilac-line)" }} />
          </div>

          <div className="grid gap-3.5 md:grid-cols-2">
            {ITEMS.map(({ key, icon }) => (
              <div
                key={key}
                className="flex items-center gap-3.5 rounded-[24px] border-[1.5px] bg-white p-4"
                style={{ borderColor: "var(--ewd-lilac)", boxShadow: "var(--ewd-shadow-inner)" }}
              >
                <img src={`/ewd/assets/ic/${icon}`} alt="" loading="lazy" className="w-[54px] shrink-0" />
                <span className="flex-1 text-[15px] font-semibold leading-snug text-[#2E1065]">
                  {pack.items[key][language]}
                </span>
                <img src="/ewd/assets/ic/y-check.svg" alt="" aria-hidden="true" className="w-7 shrink-0" />
              </div>
            ))}
          </div>

          <div
            className="mt-5 flex flex-col items-center justify-between gap-4 rounded-[28px] px-5 py-4 sm:flex-row sm:rounded-full sm:pl-6"
            style={{ background: "var(--ewd-lilac)" }}
          >
            <div className="flex items-center gap-3.5">
              <img src="/ewd/assets/ic/y-ampul.svg" alt="" aria-hidden="true" className="w-7" />
              <span className="text-[14px] font-bold text-[#6D28D9] sm:text-[15px]">{pack.footer[language]}</span>
            </div>
            <button type="button" onClick={scrollToContact} className="ewd-btn ewd-btn--purple ewd-btn--sm">
              {pack.cta[language]}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
