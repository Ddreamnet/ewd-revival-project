import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANGUAGES } from '@/lib/translations';
import { useSectionNav } from '@/hooks/useSectionNav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MobileNavPanel } from './MobileNavPanel';

/** Nav pill'lerinin sırası ve rozetleri — `public/ewd/assets/ic/`. */
const NAV_ITEMS = [
  { id: 'kids-packages', key: 'lessons', badge: 'nav-dersler.svg', to: null },
  { id: 'words', key: 'words', badge: 'ic-abc.svg', to: null },
  { id: 'contact', key: 'contact', badge: 'nav-iletisim.svg', to: null },
  { id: 'blog', key: 'blog', badge: 'nav-blog.svg', to: '/blog' },
] as const;

/** Logonun kaydırmayla ulaşabileceği en fazla eğim. */
const MAX_LOGO_TILT = 10;
/** Eğimin dolduğu kaydırma mesafesi — bu kadar aşağıda logo tam eğik olur. */
const TILT_RANGE_PX = 420;

/** Fare ile açılan menüde, tetikleyiciden içeriğe geçerken kapanmama payı. */
const HOVER_CLOSE_DELAY_MS = 160;

export function LandingHeader() {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const goToSection = useSectionNav();
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [scrolled, setScrolled] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    const apply = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
      // Eğim kaydırma konumundan türediği için yukarı çıkarken kendiliğinden düzelir.
      if (logoRef.current && !reduceMotion) {
        const progress = Math.min(1, window.scrollY / TILT_RANGE_PX);
        logoRef.current.style.rotate = `${(progress * MAX_LOGO_TILT).toFixed(2)}deg`;
      }
    };

    const onScroll = () => {
      // Kaydırma olayı saniyede onlarca kez gelir; çizime bir kare başına bir kez inelim.
      if (!frame) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const sections = ['hero', 'words', 'why', 'kids-packages', 'adult-packages', 'faq', 'blog', 'contact'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: 0 },
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  /** Ana sayfadayken logo en tepeye götürür; eğim de kaydırmayla birlikte düzelir. */
  const onLogoClick = (event: React.MouseEvent) => {
    if (location.pathname !== '/') return; // Başka sayfada Link ana sayfaya götürsün.
    event.preventDefault();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const isActive = (id: string) => {
    if (id === 'kids-packages') return ['kids-packages', 'adult-packages'].includes(activeSection);
    if (id === 'blog') return location.pathname.startsWith('/blog');
    return activeSection === id;
  };

  /* ------------------------------------------------------------ dil seçimi */

  const [langOpen, setLangOpen] = useState(false);
  const hoverCapable = useRef(false);
  const closeTimer = useRef<number>();

  useEffect(() => {
    // Dokunmatik ekranda "hover" beklenmedik şekilde tetiklendiği için sadece
    // gerçek fare varken menüyü üzerine gelince açıyoruz.
    hoverCapable.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    return () => window.clearTimeout(closeTimer.current);
  }, []);

  const openOnHover = () => {
    if (!hoverCapable.current) return;
    window.clearTimeout(closeTimer.current);
    setLangOpen(true);
  };

  const closeOnHover = () => {
    if (!hoverCapable.current) return;
    closeTimer.current = window.setTimeout(() => setLangOpen(false), HOVER_CLOSE_DELAY_MS);
  };

  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <header
      className="sticky top-0 z-50 border-b-[3px] transition-shadow"
      style={{
        background: 'var(--ewd-cream)',
        borderColor: 'var(--ewd-cream-edge)',
        boxShadow: scrolled ? '0 10px 24px -20px rgba(46,16,101,0.5)' : 'none',
      }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-1.5 sm:px-6 lg:px-10 lg:py-2">
        <Link to="/" aria-label={t.header.home[language]} className="shrink-0" onClick={onLogoClick}>
          {/* Logo dosyasının altında/üstünde ~%10 saydam pay var; negatif marj o payı
              düzenden düşürüyor, böylece yıldız büyürken başlık şişmiyor. */}
          <img
            ref={logoRef}
            src="/uploads/logo.webp"
            alt="English with Dilara"
            className="-my-[7px] h-[76px] w-auto origin-center transition-transform duration-200 hover:scale-[1.03] sm:-my-[8px] sm:h-[88px] lg:-my-[10px] lg:h-[104px]"
          />
        </Link>

        {/* Masaüstü nav — 3D rozetli pembe pill'ler */}
        <nav className="hidden items-center gap-2.5 lg:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ewd-navpill"
              data-active={isActive(item.id)}
              onClick={() => (item.to ? navigate(item.to) : goToSection(item.id))}
            >
              <span className="ewd-navpill__badge">
                <img src={`/ewd/assets/ic/${item.badge}`} alt="" loading="lazy" />
              </span>
              {t.header[item.key][language]}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dil seçimi — masaüstünde üzerine gelince açılır, dokunmatikte tıklayınca */}
          <DropdownMenu
            open={langOpen}
            onOpenChange={setLangOpen}
            // Menü açıkken sayfanın geri kalanı tıklanabilir kalsın; fareyle
            // açılan bir menüyü kilitlemek gezinmeyi zorlaştırır.
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ewd-lang"
                aria-label={t.header.language[language]}
                onMouseEnter={openOnHover}
                onMouseLeave={closeOnHover}
              >
                <img src={current.flagIcon} alt="" aria-hidden="true" className="ewd-lang__flag" />
                {current.label}
                <ChevronDown className="ewd-lang__chev" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="ewd-langmenu z-[60]"
              onMouseEnter={openOnHover}
              onMouseLeave={closeOnHover}
            >
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  data-active={language === lang.code}
                  className="ewd-langitem"
                >
                  <img src={lang.flagIcon} alt="" aria-hidden="true" className="ewd-langitem__flag" />
                  {lang.name}
                  {language === lang.code && <span className="ewd-langitem__dot" aria-hidden="true" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link to="/login" className="ewd-btn ewd-btn--purple ewd-btn--sm hidden sm:inline-flex">
            {t.header.login[language]}
          </Link>

          <MobileNavPanel onNavigateSection={goToSection} />
        </div>
      </div>
    </header>
  );
}
