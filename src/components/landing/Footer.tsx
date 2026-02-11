import { Link } from 'react-router-dom';
import { Star, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const whatsappLogo = '/uploads/whatsappLogo.png';
const instagramLogo = '/uploads/instagramLogo.png';

export function Footer() {
  const { language, t } = useLanguage();

  return (
    <footer className="px-4 md:px-8 pb-8">
      <div className="relative max-w-6xl mx-auto bg-white/70 rounded-3xl shadow-xl py-10 px-6 md:px-10">
        {/* Sparkle decorations */}
        <Star className="absolute top-4 left-5 w-5 h-5 text-landing-yellow opacity-40 fill-landing-yellow/30" />
        <Sparkles className="absolute top-4 right-5 w-4 h-4 text-landing-pink opacity-40" />

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Left — Logo + Tagline */}
          <div className="flex flex-col items-center md:items-start">
            <Link to="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-pink rounded-lg">
              <img
                src="/uploads/logo.webp"
                alt="English with Dilara"
                className="h-12 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-foreground/60 mt-2 text-center md:text-left">
              {t.footer.tagline[language]}
            </p>
          </div>

          {/* Center — Pill links */}
          <div className="flex flex-col items-center gap-3">
            <Link
              to="/bizimle-calisin"
              className="inline-block w-full max-w-xs text-center px-5 py-2 rounded-full bg-landing-purple/15 text-foreground/70 font-medium text-sm hover:bg-landing-pink/30 hover:text-landing-purple-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-pink"
            >
              {t.footer.workWithUs[language]}
            </Link>
            <Link
              to="/gizlilik-politikasi"
              className="inline-block w-full max-w-xs text-center px-5 py-2 rounded-full bg-landing-purple/15 text-foreground/70 font-medium text-sm hover:bg-landing-pink/30 hover:text-landing-purple-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-pink"
            >
              {t.footer.privacyPolicy[language]}
            </Link>
          </div>

          {/* Right — Social + Store */}
          <div className="flex flex-col items-center md:items-end gap-4">
            {/* Social icon buttons */}
            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/905306792831"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-landing-purple/15 flex items-center justify-center hover:bg-landing-pink/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-pink"
                aria-label="WhatsApp"
              >
                <img src={whatsappLogo} alt="WhatsApp" className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com/englishwithdilarateacher"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-landing-purple/15 flex items-center justify-center hover:bg-landing-pink/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-pink"
                aria-label="Instagram"
              >
                <img src={instagramLogo} alt="Instagram" className="w-5 h-5" />
              </a>
            </div>

            {/* Disabled store buttons */}
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
              <div className="flex flex-col items-center">
                <div className="px-4 py-2 rounded-xl bg-landing-purple/10 text-foreground/40 text-xs font-medium opacity-60 cursor-not-allowed">
                  Google Play
                </div>
                <span className="text-[10px] text-foreground/40 mt-0.5">
                  {t.footer.comingSoon[language]}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div className="px-4 py-2 rounded-xl bg-landing-purple/10 text-foreground/40 text-xs font-medium opacity-60 cursor-not-allowed">
                  App Store
                </div>
                <span className="text-[10px] text-foreground/40 mt-0.5">
                  {t.footer.comingSoon[language]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-landing-purple/15 mt-8 pt-6 text-center">
          <p className="text-xs text-foreground/40">
            © {new Date().getFullYear()} English with Dilara. {t.footer.copyright[language]}
          </p>
        </div>
      </div>
    </footer>
  );
}
