import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/translations";

const COPY: Record<Language, { title: string; lead: string; home: string }> = {
  tr: {
    title: "Bu sayfayı bulamadık",
    lead: "Aradığınız adres taşınmış ya da hiç var olmamış olabilir.",
    home: "Ana sayfaya dön",
  },
  en: {
    title: "We couldn't find that page",
    lead: "The address you're after may have moved, or never existed.",
    home: "Back to home",
  },
  fr: {
    title: "Page introuvable",
    lead: "L'adresse recherchée a peut-être changé, ou n'a jamais existé.",
    home: "Retour à l'accueil",
  },
};

const NotFound = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const copy = COPY[language];

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div
      className="ewd-light flex min-h-screen items-center justify-center px-5 py-16"
      style={{ background: "var(--ewd-cream)" }}
    >
      <div
        className="ewd-dots relative flex w-full max-w-[520px] flex-col items-center gap-4 rounded-[42px] border-[3px] px-8 py-12 text-center"
        style={{
          backgroundColor: "#FFFDF6",
          borderColor: "#F3DAE5",
          ["--dot" as string]: "#E7B4C8",
          boxShadow: "var(--ewd-shadow-card)",
        }}
      >
        <img
          src="/ewd/assets/art-book-aa.png"
          alt=""
          aria-hidden="true"
          className="w-[120px]"
          style={{ filter: "drop-shadow(0 12px 18px rgba(46,16,101,0.2))" }}
        />
        <span className="ewd-script text-[64px] leading-none text-[#A253BE]">404</span>
        <h1 className="text-[26px] font-black tracking-[-0.02em] text-[#2E1065]">{copy.title}</h1>
        <p className="ewd-lead max-w-[360px]">{copy.lead}</p>
        <Link to="/" className="ewd-btn ewd-btn--purple mt-2">
          {copy.home}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
