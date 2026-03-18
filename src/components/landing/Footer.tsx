import { Link } from "react-router-dom";
import { Instagram, MessageCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const socials = [
{
  label: "Instagram",
  icon: Instagram,
  href: "https://instagram.com/englishwithdilarateacher"
},
{
  label: "WhatsApp",
  icon: MessageCircle,
  href: "https://wa.me/905306792831"
}] as
const;

export function Footer() {
  const { language, t } = useLanguage();

  return (
    <footer className="bg-landing-purple/20 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-[12px] py-[12px] pt-[12px] pb-[12px]">
        {/* Main row */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          {/* Left – Logo + Tagline */}
          <div className="flex-col items-center gap-2 flex md:items-center justify-start">
            <Link to="/">
              <img src="/uploads/logo.webp" alt="English with Dilara" className="h-28 w-auto object-contain" />
            </Link>
            <p className="text-sm text-[#4A2040]/70 dark:text-muted-foreground text-center md:text-left">{t.footer.tagline[language]}</p>
          </div>

          {/* Center – Links */}
          <div className="items-center gap-6 md:gap-16 flex-row flex md:items-center justify-center self-center">
            <Link
              to="/bizimle-calisin"
              className="text-sm font-medium text-[#4A2040] dark:text-foreground hover:text-landing-pink hover:underline underline-offset-4 transition-colors">
              {t.footer.workWithUs[language]}
            </Link>
            <Link
              to="/gizlilik-politikasi"
              className="text-sm font-medium text-[#4A2040] dark:text-foreground hover:text-landing-pink hover:underline underline-offset-4 transition-colors">
              {t.footer.privacyPolicy[language]}
            </Link>
          </div>

          {/* Right – Socials + Store */}
          <div className="flex-col items-center gap-4 flex md:items-center justify-start">
            {/* Social icons */}
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-3">
                {socials.map(({ label, icon: Icon, href }) =>
                <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="w-10 h-10 rounded-full bg-[#FFF0F6] dark:bg-card border border-[#D98BB5] dark:border-border shadow-sm flex items-center justify-center text-[#4A2040] dark:text-foreground hover:bg-[#FFE0EE] dark:hover:bg-muted hover:text-[#7C2D6B] dark:hover:text-primary transition-colors duration-200">
                        <Icon className="w-5 h-5" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {label}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>

            {/* Store download badges */}
            {!Capacitor.isNativePlatform() && (
              <div className="flex flex-col items-center gap-2.5 mt-1">
                {/* Google Play Badge */}
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="group relative flex items-center gap-2.5 rounded-lg bg-[#1a1a2e] px-4 py-2 min-w-[170px] hover:bg-[#2a2a3e] transition-colors duration-200 cursor-pointer opacity-80 hover:opacity-100"
                  aria-label={t.footer.downloadGooglePlay[language]}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92z" fill="#4285F4"/>
                    <path d="M17.556 8.235L5.207.805a1.003 1.003 0 00-1.043-.015L14.848 11.47l2.708-3.235z" fill="#34A853"/>
                    <path d="M20.996 11.08l-3.44-2.845-3.764 3.765 3.764 3.764 3.44-2.844a1.19 1.19 0 000-1.84z" fill="#FBBC04"/>
                    <path d="M4.164 23.21a1.004 1.004 0 001.043-.015l12.349-7.43-2.708-2.708L4.164 23.21z" fill="#EA4335"/>
                  </svg>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[9px] text-white/70 uppercase tracking-wide">
                      {language === 'tr' ? "İNDİR" : "GET IT ON"}
                    </span>
                    <span className="text-[13px] font-semibold text-white -mt-0.5">Google Play</span>
                  </div>
                  <span className="absolute -top-2 -right-2 bg-landing-pink text-[8px] font-bold text-[#4A2040] dark:text-foreground px-1.5 py-0.5 rounded-full shadow-sm">
                    {t.footer.comingSoon[language]}
                  </span>
                </a>

                {/* App Store Badge */}
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="group relative flex items-center gap-2.5 rounded-lg bg-[#1a1a2e] px-4 py-2 min-w-[170px] hover:bg-[#2a2a3e] transition-colors duration-200 cursor-pointer opacity-80 hover:opacity-100"
                  aria-label={t.footer.downloadAppStore[language]}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="white">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[9px] text-white/70 uppercase tracking-wide">
                      {language === 'tr' ? "İNDİR" : "Download on the"}
                    </span>
                    <span className="text-[13px] font-semibold text-white -mt-0.5">App Store</span>
                  </div>
                  <span className="absolute -top-2 -right-2 bg-landing-pink text-[8px] font-bold text-[#4A2040] dark:text-foreground px-1.5 py-0.5 rounded-full shadow-sm">
                    {t.footer.comingSoon[language]}
                  </span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Divider + Copyright */}
        <div className="border-t border-[#E9AFCB]/40 dark:border-border text-center my-[4px] mt-[4px] pt-[12px]">
          <p className="text-sm text-[#4A2040]/60 dark:text-muted-foreground">
            © {new Date().getFullYear()} English with Dilara. {t.footer.copyright[language]}
          </p>
        </div>
      </div>
    </footer>
  );
}