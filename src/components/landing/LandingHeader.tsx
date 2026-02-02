import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, LogIn, BookOpen, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function LandingHeader() {
  const { language, setLanguage, t } = useLanguage();
  const [activeSection, setActiveSection] = useState<string>('hero');

  useEffect(() => {
    const sections = ['hero', 'why', 'kids-packages', 'adult-packages', 'faq', 'contact'];
    
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
    }
  };

  const isLessonsActive = ['kids-packages', 'adult-packages'].includes(activeSection);
  const isContactActive = activeSection === 'contact';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent overflow-visible">
      {/* Logo - Absolute positioned, independent from header flow */}
      <div className="absolute left-2 sm:left-4 lg:left-8 top-1 sm:top-2 md:top-3 z-[60]">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="focus:outline-none"
          aria-label="Sayfanın başına git"
        >
          <img
            src="/uploads/logo.webp"
            alt="English with Dilara"
            className="h-20 sm:h-28 md:h-40 w-auto transform -rotate-[10deg] hover:scale-105 transition-transform duration-300 cursor-pointer"
          />
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex items-center justify-between h-20 md:h-24">
          {/* Invisible placeholder for logo space */}
          <div className="w-20 sm:w-28 md:w-40 flex-shrink-0 invisible" />

          {/* Menu - Absolute Center */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4">
            {/* Lessons Button - Mobile: Icon only, Desktop: Text */}
            <button
              onClick={() => scrollToSection('kids-packages')}
              className={`md:hidden rounded-full p-2.5 transition-all duration-300 ${
                isLessonsActive
                  ? 'bg-landing-purple/20 text-landing-purple-dark shadow-[0_0_12px_rgba(147,112,219,0.4)]'
                  : 'bg-landing-purple/10 text-landing-purple-dark hover:bg-landing-purple/20 hover:scale-110 hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]'
              }`}
              aria-label={t.header.lessons[language]}
            >
              <BookOpen className="h-5 w-5" />
            </button>
            <button
              onClick={() => scrollToSection('kids-packages')}
              className={`hidden md:block px-6 py-2.5 rounded-full text-base font-medium transition-all duration-300 ${
                isLessonsActive
                  ? 'bg-landing-pink/90 text-foreground shadow-md'
                  : 'bg-landing-pink/70 text-foreground hover:bg-landing-pink/80'
              }`}
            >
              {t.header.lessons[language]}
            </button>

            {/* Contact Button - Mobile: Icon only, Desktop: Text */}
            <button
              onClick={() => scrollToSection('contact')}
              className={`md:hidden rounded-full p-2.5 transition-all duration-300 ${
                isContactActive
                  ? 'bg-landing-purple/20 text-landing-purple-dark shadow-[0_0_12px_rgba(147,112,219,0.4)]'
                  : 'bg-landing-purple/10 text-landing-purple-dark hover:bg-landing-purple/20 hover:scale-110 hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]'
              }`}
              aria-label={t.header.contact[language]}
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className={`hidden md:block px-6 py-2.5 rounded-full text-base font-medium transition-all duration-300 ${
                isContactActive
                  ? 'bg-landing-pink/90 text-foreground shadow-md'
                  : 'bg-landing-pink/70 text-foreground hover:bg-landing-pink/80'
              }`}
            >
              {t.header.contact[language]}
            </button>
          </nav>

          {/* Language + Login - Right */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Language Dropdown - Creative Purple Design */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-landing-purple/10 text-landing-purple-dark 
                             hover:bg-landing-purple/20 hover:scale-110 
                             hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]
                             transition-all duration-300"
                >
                  <Globe className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-sm z-[60]">
                <DropdownMenuItem
                  onClick={() => setLanguage('tr')}
                  className={`cursor-pointer ${language === 'tr' ? 'bg-landing-purple/20' : ''}`}
                >
                  🇹🇷 TR
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('en')}
                  className={`cursor-pointer ${language === 'en' ? 'bg-landing-purple/20' : ''}`}
                >
                  🇬🇧 GB
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Login Button - Creative Purple Design */}
            <Link to="/login">
              {/* Desktop: Text button with sparkle */}
              <Button
                variant="ghost"
                className="hidden md:flex items-center rounded-full px-4 font-medium
                           bg-gradient-to-r from-landing-purple/15 to-landing-pink/15
                           text-landing-purple-dark
                           hover:from-landing-purple/25 hover:to-landing-pink/25
                           hover:scale-105 hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]
                           transition-all duration-300"
              >
                {t.header.login[language]}
              </Button>
              {/* Mobile: Icon button matching globe style */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden rounded-full bg-landing-purple/10 text-landing-purple-dark
                           hover:bg-landing-purple/20 hover:scale-110 
                           hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]
                           transition-all duration-300"
                aria-label={t.header.login[language]}
              >
                <LogIn className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}