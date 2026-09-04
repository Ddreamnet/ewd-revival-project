import { Capacitor } from "@capacitor/core";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSectionNav } from "@/hooks/useSectionNav";

const APP_STORE_URL = "https://apps.apple.com/tr/app/english-with-dilara/id6760347669?l=tr";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.englishwithdilara.app";

const SOCIALS = [
  { label: "WhatsApp", icon: "icon-whatsapp.png", href: "https://wa.me/905306792831" },
  { label: "Instagram", icon: "icon-send.png", href: "https://instagram.com/englishwithdilarateacher" },
  { label: "E-posta", icon: "icon-mail.png", href: "mailto:admin@englishwithdilara.com" },
];

interface FooterProps {
  /** Footer'ın üstündeki bölümün zemin rengi — dalgalı geçiş bu renkle çizilir. */
  topColor?: string;
}

/** Footer — üstünde dalgalı geçiş olan koyu mor blok. */
export function Footer({ topColor = "var(--ewd-cream)" }: FooterProps = {}) {
  const { language, t } = useLanguage();
  const goToSection = useSectionNav();
  const isNative = Capacitor.isNativePlatform();

  return (
    <footer className="relative mt-16 px-5 pb-8 pt-14 sm:px-8" style={{ background: "#2E1065" }}>
      <span className="ewd-scallop-t" style={{ ["--scallop" as string]: topColor }} aria-hidden="true" />

      <div className="mx-auto grid max-w-[1180px] items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center justify-center gap-3.5 lg:justify-start">
          <Link to="/">
            <img src="/uploads/logo.webp" alt="English with Dilara" className="h-14 w-auto" />
          </Link>
          <span className="text-[14px] font-semibold text-[#C4A6E8]">{t.footer.tagline[language]}</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[15px] font-bold text-[#E4D3F5]">
          <Link to="/bizimle-calisin" className="transition-colors hover:text-[#FBD34F]">
            {t.footer.workWithUs[language]}
          </Link>
          <Link to="/gizlilik-politikasi" className="transition-colors hover:text-[#FBD34F]">
            {t.footer.privacyPolicy[language]}
          </Link>
          <button
            type="button"
            onClick={() => goToSection("words")}
            className="font-bold transition-colors hover:text-[#FBD34F]"
          >
            {t.header.words[language]}
          </button>
        </nav>

        <div className="flex flex-col items-center gap-3 lg:items-end">
          <div className="flex gap-2.5">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="transition-transform hover:-translate-y-0.5"
              >
                <img src={`/ewd/assets/${social.icon}`} alt="" aria-hidden="true" className="w-[38px]" />
              </a>
            ))}
          </div>

          {!isNative && (
            <div className="flex flex-wrap justify-center gap-2.5">
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-[#E4D3F5] transition-colors hover:text-[#FBD34F]"
                style={{ background: "rgba(255,248,239,0.12)" }}
              >
                {t.footer.downloadGooglePlay[language]}
              </a>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-[#E4D3F5] transition-colors hover:text-[#FBD34F]"
                style={{ background: "rgba(255,248,239,0.12)" }}
              >
                {t.footer.downloadAppStore[language]}
              </a>
            </div>
          )}
        </div>
      </div>

      <p className="mt-8 text-center text-[12px] text-[#9A7EC0]">
        © {new Date().getFullYear()} English with Dilara. {t.footer.copyright[language]}
      </p>
    </footer>
  );
}
