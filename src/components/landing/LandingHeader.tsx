import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, LogIn } from 'lucide-react';
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 md:h-24">
          {/* Logo - Left */}
          <div className="flex-shrink-0">
            <img
              src="/uploads/logo.webp"
              alt="English with Dilara"
              className="h-14 md:h-20 w-auto transform -rotate-[10deg] hover:scale-105 transition-transform duration-300"
            />
          </div>

          {/* Menu - Center */}
          <nav className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => scrollToSection('kids-packages')}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-medium transition-all duration-300 ${
                isLessonsActive
                  ? 'bg-landing-pink/90 text-foreground shadow-md'
                  : 'bg-landing-pink/70 text-foreground hover:bg-landing-pink/80'
              }`}
            >
              {t.header.lessons[language]}
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-medium transition-all duration-300 ${
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
            {/* Language Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-landing-pink/30"
                >
                  <Globe className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-sm z-[60]">
                <DropdownMenuItem
                  onClick={() => setLanguage('tr')}
                  className={`cursor-pointer ${language === 'tr' ? 'bg-landing-pink/30' : ''}`}
                >
                  🇹🇷 TR
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('en')}
                  className={`cursor-pointer ${language === 'en' ? 'bg-landing-pink/30' : ''}`}
                >
                  🇬🇧 GB
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Login Button */}
            <Link to="/login">
              {/* Desktop: Text button */}
              <Button
                variant="ghost"
                className="hidden md:flex rounded-full hover:bg-landing-pink/30 font-medium"
              >
                {t.header.login[language]}
              </Button>
              {/* Mobile: Icon button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden rounded-full hover:bg-landing-pink/30"
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
