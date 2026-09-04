import { useLanguage } from "@/contexts/LanguageContext";

const FEATURES = [
  { key: "personalProgram", icon: "n-kisi.svg" },
  { key: "oneOnOne", icon: "n-ikili.svg" },
  { key: "liveZoom", icon: "n-video.svg" },
  { key: "speakingFocused", icon: "n-sohbet.svg" },
  { key: "regularTracking", icon: "n-pano.svg" },
  { key: "freeTrial", icon: "n-hediye.svg" },
] as const;

/**
 * "Neden English with Dilara?" — koyu mor blok, tarak kenarlı, yıldız dokulu.
 * Sağda 3D rozetleri sola taşan liste satırları.
 */
export function WhySection() {
  const { language, t } = useLanguage();

  const scrollToContact = () => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section
      id="why"
      className="ewd-bulge-host scroll-section relative px-5 py-20 sm:px-8 md:py-24 lg:py-[104px]"
      style={{ background: "#6D28D9" }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.32]"
        style={{ backgroundImage: "url(/ewd/pat/tile-star-purple.png)", backgroundSize: "280px" }}
        aria-hidden="true"
      />
      {/* Tarak geçişi — mor zemin yıldız dokusuyla birlikte üstteki ve alttaki
          bölüme sarkar, desen kesilmeden devam eder. */}
      <span className="ewd-bulge" style={{ ["--bulge" as string]: "#6D28D9" }} aria-hidden="true">
        <span
          className="ewd-bulge__tex opacity-[0.32]"
          style={{ backgroundImage: "url(/ewd/pat/tile-star-purple.png)", backgroundSize: "280px" }}
        />
      </span>

      <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 lg:grid-cols-[452px_1fr] lg:gap-[60px]">
        <div className="flex flex-col items-start gap-1">
          <span className="ewd-script text-[46px] leading-none text-[#FBD34F] sm:text-[58px] lg:text-[68px]">
            {t.why.title[language]}
          </span>
          <div className="ewd-lockup ewd-lockup--onDark">
            <span className="ewd-lockup__english">ENGLISH</span>
            <span className="ewd-lockup__with">with</span>
            <span className="ewd-lockup__dilara">
              Dilara
              <span className="font-sans text-[0.76em] font-black text-[#FBD34F]">?</span>
            </span>
          </div>

          <p className="mt-5 max-w-[400px] text-[16px] font-medium leading-[1.6] text-[#E4D3F5] sm:text-[17px]">
            {t.why.lead[language]}
          </p>

          <button type="button" onClick={scrollToContact} className="ewd-btn ewd-btn--yellow mt-6">
            {t.why.cta[language]}
          </button>
        </div>

        <ul className="flex flex-col gap-3 pl-2 sm:pl-3">
          {FEATURES.map(({ key, icon }) => (
            <li key={key} className="ewd-row">
              <img src={`/ewd/assets/ic/${icon}`} alt="" loading="lazy" className="ewd-row__icon" />
              <span className="ewd-row__dot" aria-hidden="true" />
              <span className="text-[16px] font-bold text-[#2F2A3A] sm:text-[18px]">
                {t.why.features[key][language]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
