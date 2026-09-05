import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { whatsappTrialLink } from "@/lib/whatsapp";
import { WhatsAppMark } from "@/components/landing/WhatsAppMark";


type Audience = "kids" | "adults";

/**
 * Hero.
 *
 * Tasarımda iki ayrı artboard var, bu yüzden burada da iki ayrı düzen var:
 *  · Masaüstü (lg+): üç panel — kopya kartı · öğretmen fotoğrafı · giriş kartları.
 *  · Mobil (<lg): ortalanmış kopya + altında kemer biçimli fotoğraf nişi.
 * Ortak parçalar (hedef kitle pill'leri, giriş kartları) aşağıda paylaşılıyor.
 */
export function HeroSection() {
  const { language, t } = useLanguage();
  const [audience, setAudience] = useState<Audience>("kids");

  const whatsappLink = whatsappTrialLink(language);

  const lead = audience === "kids" ? t.hero.lead[language] : t.hero.leadAdults[language];
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section
      id="hero"
      className="scroll-section relative px-3 pb-6 pt-4 sm:px-5 sm:pb-8"
      style={{ background: "var(--ewd-cream)" }}
    >
      {/* ==================================================== MOBİL DÜZEN ==== */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div
          className="relative overflow-hidden rounded-[34px] border-[3px]"
          style={{ background: "var(--ewd-cream)", borderColor: "#EFDFF9" }}
        >
          <div className="relative z-10 flex flex-col items-center gap-3.5 px-5 pt-4 sm:px-7">
            <AudiencePills audience={audience} onChange={setAudience} compact />

            <div className="ewd-lockup items-center">
              <span className="ewd-lockup__english text-[40px] sm:text-[46px]">ENGLISH</span>
              <span className="ewd-lockup__with pl-0 text-[15px] sm:text-[17px]">with</span>
              <span className="ewd-lockup__dilara text-[54px] sm:text-[62px]">Dilara</span>
            </div>

            <p className="max-w-[300px] text-center text-[14px] font-medium leading-[1.55] text-[#5B4A6E] [text-wrap:pretty] sm:max-w-[380px] sm:text-[15px]">
              {lead}
            </p>

            <div className="flex w-full items-center gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={() => scrollTo("contact")}
                className="ewd-btn ewd-btn--pink flex-1 !px-3 !py-[17px] !text-[15px]"
              >
                {t.hero.ctaTrial[language]}
              </button>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.hero.ctaWhatsapp[language]}
                className="ewd-btn ewd-btn--wa h-[54px] w-[54px] shrink-0 !p-0"
              >
                <WhatsAppMark className="h-7 w-7" />
              </a>
            </div>
          </div>

          {/* Kemer nişi — fotoğraf zemini yarım daire olarak kesiliyor */}
          <div className="relative mt-5 h-[212px]">
            <div className="absolute bottom-0 left-1/2 h-[188px] w-[86%] max-w-[340px] -translate-x-1/2 overflow-hidden rounded-t-[170px]">
              <img src="/ewd/pat/b.webp" alt="" aria-hidden="true" className="h-full w-full object-cover" />
            </div>
            <img
              src="/uploads/dilarateacher.webp"
              alt={t.hero.teacherAlt[language]}
              className="absolute -bottom-[2px] left-1/2 h-[212px] w-auto -translate-x-1/2"
              style={{ filter: "drop-shadow(0 12px 18px rgba(46,16,101,0.2))" }}
            />
          </div>
        </div>

        <EntryCards onNavigate={scrollTo} className="grid grid-cols-1 gap-4 sm:grid-cols-2" />
      </div>

      {/* ================================================= MASAÜSTÜ DÜZEN ==== */}
      <div className="mx-auto hidden max-w-[1400px] gap-4 lg:grid lg:h-[636px] lg:grid-cols-[1.55fr_1.35fr_0.85fr]">
        <div
          className="ewd-dots relative flex flex-col items-start justify-center gap-4 overflow-hidden rounded-[42px] border-[3px] px-10 py-11"
          style={{
            backgroundColor: "#FFFDF6",
            borderColor: "#F3DAE5",
            ["--dot" as string]: "#E7B4C8",
          }}
        >
          <AudiencePills audience={audience} onChange={setAudience} />

          <div className="ewd-lockup">
            <span className="ewd-lockup__english">ENGLISH</span>
            <span className="ewd-lockup__with">with</span>
            <span className="ewd-lockup__dilara">Dilara</span>
          </div>

          <p className="ewd-lead max-w-[430px]">{lead}</p>

          <div className="flex flex-wrap items-center gap-3 pt-1.5">
            <button type="button" className="ewd-btn ewd-btn--pink" onClick={() => scrollTo("contact")}>
              {t.hero.ctaTrial[language]}
            </button>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="ewd-btn ewd-btn--wa">
              <WhatsAppMark className="h-7 w-7" />
              {t.hero.ctaWhatsapp[language]}
            </a>
          </div>
        </div>

        <div
          className="relative flex items-end justify-end overflow-hidden rounded-[42px] border-[3px]"
          style={{ borderColor: "var(--ewd-pink-line)", background: "#FFF1F7" }}
        >
          <img
            src="/ewd/pat/b.webp"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          {/* PNG'nin altında ~6px saydam pay var; kutuya tam dayanması için geri alınıyor. */}
          <img
            src="/uploads/dilarateacher.webp"
            alt={t.hero.teacherAlt[language]}
            className="relative -mb-[5px] h-[588px] w-auto"
            style={{ filter: "drop-shadow(0 18px 24px rgba(46,16,101,0.22))" }}
          />
        </div>

        <EntryCards onNavigate={scrollTo} className="grid grid-rows-[1.42fr_1fr] gap-4" />
      </div>
    </section>
  );
}

/** Hedef kitle seçici — seçilen değere göre hero metni değişir. */
function AudiencePills({
  audience,
  onChange,
  compact = false,
}: {
  audience: Audience;
  onChange: (next: Audience) => void;
  compact?: boolean;
}) {
  const { language, t } = useLanguage();

  const pill = (value: Audience, label: string) => {
    const active = audience === value;
    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        aria-pressed={active}
        className={`rounded-full border-2 font-extrabold uppercase transition-colors ${
          compact
            ? "px-4 py-[13px] text-[11px] tracking-[0.12em]"
            : "px-5 py-2.5 text-[12px] tracking-[0.14em]"
        }`}
        style={
          active
            ? { background: "var(--ewd-purple)", borderColor: "var(--ewd-purple)", color: "#fff" }
            : { background: "transparent", borderColor: "#DDC8F2", color: "#7C3AED" }
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {pill("kids", t.hero.badgeKids[language])}
      {pill("adults", t.hero.badgeAdults[language])}
    </div>
  );
}

/** Çocuk / yetişkin paketlerine götüren iki renkli giriş kartı. */
function EntryCards({ onNavigate, className }: { onNavigate: (id: string) => void; className?: string }) {
  const { language, t } = useLanguage();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => onNavigate("kids-packages")}
        className="group relative flex min-h-[168px] flex-col justify-end gap-2 overflow-hidden rounded-[32px] p-6 text-left sm:rounded-[42px]"
        style={{ background: "var(--ewd-purple)" }}
      >
        <img
          src="/ewd/assets/art-book-aa.svg"
          alt=""
          aria-hidden="true"
          className="absolute right-3 top-4 w-[112px] transition-transform duration-300 group-hover:-rotate-6 lg:w-[132px]"
          style={{ filter: "drop-shadow(0 10px 16px rgba(20,4,50,0.3))" }}
        />
        <span className="relative whitespace-pre-line text-[24px] font-black leading-[1.05] tracking-[-0.01em] text-[#FFF8EF] lg:text-[26px]">
          {t.hero.kidsCardTitle[language]}
        </span>
        <span className="relative text-[14px] font-semibold leading-snug text-[#F0DAF9]">
          {t.hero.kidsCardSub[language]}
        </span>
        <span className="relative mt-1.5 self-start rounded-full bg-[#FFF8EF] px-4 py-2.5 text-[13px] font-extrabold text-[#6D28D9]">
          {t.hero.kidsCardCta[language]} →
        </span>
      </button>

      <button
        type="button"
        onClick={() => onNavigate("adult-packages")}
        className="group relative flex min-h-[136px] flex-col justify-end gap-1.5 overflow-hidden rounded-[32px] p-6 text-left sm:rounded-[42px]"
        style={{ background: "var(--ewd-yellow)" }}
      >
        <img
          src="/ewd/assets/art-graduation.svg"
          alt=""
          aria-hidden="true"
          className="absolute right-3 top-3 w-[118px] transition-transform duration-300 group-hover:-rotate-6 lg:w-[138px]"
          style={{ filter: "drop-shadow(0 10px 16px rgba(80,60,0,0.22))" }}
        />
        <span className="relative whitespace-pre-line text-[22px] font-black leading-[1.05] tracking-[-0.01em] text-[#2E1065] lg:text-[24px]">
          {t.hero.adultCardTitle[language]}
        </span>
        <span className="relative text-[14px] font-semibold leading-snug text-[#6B4A00]">
          {t.hero.adultCardSub[language]}
        </span>
      </button>
    </div>
  );
}
