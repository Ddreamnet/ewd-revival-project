import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const whatsappLogo = '/uploads/whatsappLogo.png';
const instagramLogo = '/uploads/instagramLogo.png';

export function Footer() {
  const { language, t } = useLanguage();

  return (
    <footer className="bg-white/70 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          {/* Left - Logo */}
          <div className="flex-shrink-0">
            <Link to="/">
              <img
                src="/uploads/logo.webp"
                alt="English with Dilara"
                className="h-12 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Center - Links */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <Link
              to="/bizimle-calisin"
              className="text-foreground/70 hover:text-landing-pink transition-colors font-medium"
            >
              {t.footer.workWithUs[language]}
            </Link>
            <Link
              to="/gizlilik-politikasi"
              className="text-foreground/70 hover:text-landing-pink transition-colors font-medium"
            >
              {t.footer.privacyPolicy[language]}
            </Link>
          </div>

          {/* Right - Social + Store */}
          <div className="flex flex-col items-center md:items-end gap-4">
            {/* Social Icons */}
            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/905306792831"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <img src={whatsappLogo} alt="WhatsApp" className="w-8 h-8" />
              </a>
              <a
                href="https://instagram.com/englishwithdilarateacher"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <img src={instagramLogo} alt="Instagram" className="w-8 h-8" />
              </a>
            </div>

            {/* Store Buttons - Disabled */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col items-center opacity-60 cursor-not-allowed">
                <div className="px-4 py-2 bg-foreground/10 rounded-lg text-xs font-medium text-foreground/60">
                  Google Play
                </div>
                <span className="text-[10px] text-foreground/50 mt-0.5">
                  {t.footer.comingSoon[language]}
                </span>
              </div>
              <div className="flex flex-col items-center opacity-60 cursor-not-allowed">
                <div className="px-4 py-2 bg-foreground/10 rounded-lg text-xs font-medium text-foreground/60">
                  App Store
                </div>
                <span className="text-[10px] text-foreground/50 mt-0.5">
                  {t.footer.comingSoon[language]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-foreground/10 text-center">
          <p className="text-sm text-foreground/50">
            © {new Date().getFullYear()} English with Dilara. {t.footer.copyright[language]}
          </p>
        </div>
      </div>
    </footer>
  );
}
