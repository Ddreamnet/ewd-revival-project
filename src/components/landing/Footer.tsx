import { Link } from "react-router-dom";
import { Instagram, MessageCircle, Smartphone } from "lucide-react";
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
      <div className="max-w-6xl mx-auto pt-[24px] pb-[24px] px-[12px] py-[12px]">
        {/* Main row */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          {/* Left – Logo + Tagline */}
          <div className="flex-col items-center gap-2 flex md:items-center justify-start">
            <Link to="/">
              <img src="/uploads/logo.webp" alt="English with Dilara" className="h-28 w-auto object-contain" />
            </Link>
            <p className="text-sm text-[#4A2040]/70 text-center md:text-left">{t.footer.tagline[language]}</p>
          </div>

          {/* Center – Links */}
          <div className="items-center gap-16 flex-row flex md:items-center justify-center self-center">
            <Link
              to="/bizimle-calisin"
              className="text-sm font-medium text-[#4A2040] hover:text-landing-pink hover:underline underline-offset-4 transition-colors">

              {t.footer.workWithUs[language]}
            </Link>
            <Link
              to="/gizlilik-politikasi"
              className="text-sm font-medium text-[#4A2040] hover:text-landing-pink hover:underline underline-offset-4 transition-colors">

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
                      className="w-10 h-10 rounded-full bg-[#FFF0F6] border border-[#D98BB5] shadow-sm flex items-center justify-center text-[#4A2040] hover:bg-[#FFE0EE] hover:text-[#7C2D6B] transition-colors duration-200">

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

            {/* Store buttons */}
            <div className="flex-wrap items-center gap-2 flex flex-col">
              {/* Google Play */}
              <div className="flex flex-col items-center">
                <button
                  disabled
                  onClick={(e) => e.preventDefault()}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 bg-[#FFF0F6] border border-[#D98BB5] text-xs font-medium text-[#4A2040] opacity-60 cursor-not-allowed">

                  <Smartphone className="w-3.5 h-3.5" />
                  {t.footer.downloadGooglePlay[language]}
                </button>
              </div>
              {/* App Store */}
              <div className="flex flex-col items-center">
                <button
                  disabled
                  onClick={(e) => e.preventDefault()}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 bg-[#FFF0F6] border border-[#D98BB5] text-xs font-medium text-[#4A2040] opacity-60 cursor-not-allowed">

                  <Smartphone className="w-3.5 h-3.5" />
                  {t.footer.downloadAppStore[language]}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Divider + Copyright */}
        <div className="border-t border-[#E9AFCB]/40 text-center my-[4px] mt-[4px] pt-[12px]">
          <p className="text-sm text-[#4A2040]/60">
            © {new Date().getFullYear()} English with Dilara. {t.footer.copyright[language]}
          </p>
        </div>
      </div>
    </footer>);

}