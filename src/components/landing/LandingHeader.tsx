import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe, LogIn, BookOpen, MessageCircle, FileText } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
'@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MobileNavPanel } from './MobileNavPanel';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';

export function LandingHeader() {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [logoRotation, setLogoRotation] = useState(0);

  useEffect(() => {
    let rafId: number;
    let lastRotation = 0;

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const whyEl = document.getElementById('why');
        if (!whyEl) return;
        const whyTop = whyEl.getBoundingClientRect().top + window.scrollY;
        const scrollY = window.scrollY;
        const rawProgress = Math.min(1, Math.max(0, scrollY / whyTop));
        // ease-out curve for smoother feel
        const progress = 1 - Math.pow(1 - rawProgress, 2);
        const rotation = progress * -10;
        if (rotation !== lastRotation) {
          lastRotation = rotation;
          setLogoRotation(rotation);
        }
      });
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const sections = ['hero', 'why', 'kids-packages', 'adult-packages', 'faq', 'blog', 'contact'];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -50% 0px', threshold: 0 }
    );

    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/', { state: { scrollTo: id } });
    }
  };

  const isLessonsActive = ['kids-packages', 'adult-packages'].includes(activeSection);
  const isContactActive = activeSection === 'contact';
  const isBlogActive = activeSection === 'blog';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent overflow-visible px-safe">
      {/* Logo - Absolute positioned, independent from header flow */}
      <div className="absolute left-2 sm:left-4 lg:left-8 top-1 sm:top-2 md:top-3 z-[60]">
        <button
          onClick={() => {
            if (window.location.pathname === '/') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              navigate('/');
            }
          }}
          className="focus:outline-none"
          aria-label="Ana sayfaya git">

          <img
            src="/uploads/logo.webp"
            alt="English with Dilara"
            className="h-20 sm:h-28 md:h-32 lg:h-40 w-auto hover:scale-105 transition-transform duration-100 ease-out cursor-pointer"
            style={{ transform: `rotate(${logoRotation}deg)` }} />

        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pt-safe">
        <div className="flex items-center justify-between h-20 md:h-24 mt-[16px]">
          {/* Invisible placeholder for logo space */}
          <div className="w-20 sm:w-28 md:w-40 flex-shrink-0 invisible" />

          {/* Menu - Absolute Center */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4">
            {/* Lessons Button - Mobile: Icon only, Desktop: Text */}
            <button
              onClick={() => scrollToSection('kids-packages')}
              className={`md:hidden rounded-full p-2.5 transition-all duration-300 ${
              isLessonsActive ?
              'bg-landing-purple/20 text-landing-purple-dark shadow-[0_0_12px_rgba(147,112,219,0.4)]' :
              'bg-landing-purple/10 text-landing-purple-dark hover:bg-landing-purple/20 hover:scale-110 hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]'}`
              }
              aria-label={t.header.lessons[language]}>

              <BookOpen className="h-5 w-5" />
            </button>
            <button
              onClick={() => scrollToSection('kids-packages')}
              className={`hidden md:block px-6 py-2.5 rounded-full text-base font-medium transition-all duration-300 ${
              isLessonsActive ?
              'bg-landing-pink/90 text-foreground shadow-md' :
              'bg-landing-pink/70 text-foreground hover:bg-landing-pink/80'}`
              }>

              {t.header.lessons[language]}
            </button>

            {/* Contact Button - Mobile: Icon only, Desktop: Text */}
            <button
              onClick={() => scrollToSection('contact')}
              className={`md:hidden rounded-full p-2.5 transition-all duration-300 ${
              isContactActive ?
              'bg-landing-purple/20 text-landing-purple-dark shadow-[0_0_12px_rgba(147,112,219,0.4)]' :
              'bg-landing-purple/10 text-landing-purple-dark hover:bg-landing-purple/20 hover:scale-110 hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]'}`
              }
              aria-label={t.header.contact[language]}>

              <MessageCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className={`hidden md:block px-6 py-2.5 rounded-full text-base font-medium transition-all duration-300 ${
              isContactActive ?
              'bg-landing-pink/90 text-foreground shadow-md' :
              'bg-landing-pink/70 text-foreground hover:bg-landing-pink/80'}`
              }>

              {t.header.contact[language]}
            </button>

            {/* Blog Button - Mobile: Icon only, Desktop: Text */}
            <button
              onClick={() => navigate('/blog')}
              className={`md:hidden rounded-full p-2.5 transition-all duration-300 ${
              isBlogActive ?
              'bg-landing-purple/20 text-landing-purple-dark shadow-[0_0_12px_rgba(147,112,219,0.4)]' :
              'bg-landing-purple/10 text-landing-purple-dark hover:bg-landing-purple/20 hover:scale-110 hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]'}`
              }
              aria-label="Blog">

              <FileText className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/blog')}
              className={`hidden md:block px-6 py-2.5 rounded-full text-base font-medium transition-all duration-300 ${
              isBlogActive ?
              'bg-landing-pink/90 text-foreground shadow-md' :
              'bg-landing-pink/70 text-foreground hover:bg-landing-pink/80'}`
              }>

              Blog
            </button>
          </nav>

          {/* Right side controls */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile: Hamburger popover panel */}
            <MobileNavPanel />

            {/* Desktop: Theme Toggle */}
            <ThemeToggleButton variant="landing" className="hidden md:flex" />

            {/* Desktop: Language Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex rounded-full bg-landing-purple/10 text-landing-purple-dark 
                             hover:bg-landing-purple/20 hover:scale-110 
                             hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]
                             transition-all duration-300">
                  <Globe className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white/95 dark:bg-popover backdrop-blur-sm z-[60]">
                <DropdownMenuItem
                  onClick={() => setLanguage('tr')}
                  className={`cursor-pointer ${language === 'tr' ? 'bg-landing-purple/20' : ''}`}>
                  🇹🇷 TR
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('en')}
                  className={`cursor-pointer ${language === 'en' ? 'bg-landing-purple/20' : ''}`}>
                  🇬🇧 GB
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop: Login Button */}
            <Link to="/login" className="hidden md:block">
              <Button
                variant="ghost"
                className="flex items-center rounded-full px-4 font-medium
                           bg-gradient-to-r from-landing-purple/15 to-landing-pink/15
                           text-landing-purple-dark
                           hover:from-landing-purple/25 hover:to-landing-pink/25
                           hover:scale-105 hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]
                           transition-all duration-300">
                {t.header.login[language]}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>);

}