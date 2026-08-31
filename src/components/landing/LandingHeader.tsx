import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANGUAGES } from '@/lib/translations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MobileNavPanel } from './MobileNavPanel';

/** Nav pill'lerinin sırası ve rozetleri — `public/ewd/assets/ic/`. */
const NAV_ITEMS = [
  { id: 'kids-packages', key: 'lessons', badge: 'nav-dersler.png', to: null },
  { id: 'words', key: 'words', badge: 'ic-abc.png', to: '/gunun-kelimeleri' },
  { id: 'contact', key: 'contact', badge: 'nav-iletisim.png', to: null },
  { id: 'blog', key: 'blog', badge: 'nav-blog.png', to: '/blog' },
] as const;

export function LandingHeader() {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  /** Aynı sayfadaysa kaydır, değilse ana sayfaya dönüp oraya kaydır. */
  const goToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/', { state: { scrollTo: id } });
    }
  };

  const isActive = (id: string) => {
    if (id === 'kids-packages') return ['kids-packages', 'adult-packages'].includes(activeSection);
    if (id === 'blog') return location.pathname.startsWith('/blog');
    if (id === 'words') return location.pathname === '/gunun-kelimeleri' || activeSection === 'words';
    return activeSection === id;
  };

  return (
    <header
      className="sticky top-0 z-50 border-b-[3px] transition-shadow"
      style={{
        background: 'var(--ewd-cream)',
        borderColor: 'var(--ewd-cream-edge)',
        boxShadow: scrolled ? '0 10px 24px -20px rgba(46,16,101,0.5)' : 'none',
      }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-10 lg:py-3">
        <Link to="/" aria-label={t.header.home[language]} className="shrink-0">
          <img
            src="/uploads/logo.webp"
            alt="English with Dilara"
            className="h-14 w-auto transition-transform duration-200 hover:scale-[1.03] sm:h-16 lg:h-[76px]"
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
          {/* Dil seçimi — TR / EN / FR */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="ewd-iconbtn" aria-label={t.header.language[language]}>
                {LANGUAGES.find((l) => l.code === language)?.label}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[60] min-w-[9rem] rounded-2xl">
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`cursor-pointer gap-2 rounded-xl text-sm font-semibold ${
                    language === lang.code ? 'bg-[#F4EDFF] text-[#6D28D9]' : ''
                  }`}
                >
                  <span aria-hidden="true">{lang.flag}</span>
                  {lang.name}
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
