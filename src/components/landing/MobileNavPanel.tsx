import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogIn, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState, useRef, useCallback, useEffect } from 'react';

function useSwitch(currentValue: boolean, onChange: (val: boolean) => void) {
  const touchStartX = useRef(0);
  const swiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    swiping.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 15) swiping.current = true;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 15) {
      const swipeRight = diff > 0;
      if (swipeRight && !currentValue) onChange(true);
      else if (!swipeRight && currentValue) onChange(false);
    }
  }, [currentValue, onChange]);

  return { onTouchStart, onTouchMove, onTouchEnd, swiping };
}

export function MobileNavPanel() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Local visual state for smooth animation before theme actually applies
  const [visualDark, setVisualDark] = useState(resolvedTheme === 'dark');

  useEffect(() => {
    setVisualDark(resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const toggleTheme = useCallback(() => {
    const next = !visualDark;
    setVisualDark(next); // animate immediately
    // Delay actual theme change so CSS transition plays before vars swap
    setTimeout(() => setTheme(next ? 'dark' : 'light'), 280);
  }, [visualDark, setTheme]);

  const langSwitch = useSwitch(language === 'en', useCallback((val: boolean) => {
    setLanguage(val ? 'en' : 'tr');
  }, [setLanguage]));

  const themeSwitch = useSwitch(visualDark, useCallback((val: boolean) => {
    setVisualDark(val);
    setTimeout(() => setTheme(val ? 'dark' : 'light'), 280);
  }, [setTheme]));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="md:hidden rounded-full p-2 bg-landing-purple/10 text-landing-purple-dark
                     hover:bg-landing-purple/20 hover:scale-110
                     hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]
                     transition-all duration-300"
          aria-label="Menü"
        >
          {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-48 rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl
                   shadow-[0_8px_32px_rgba(147,112,219,0.15)] p-2.5 space-y-2.5 z-[70]"
      >
        {/* Language Switch */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground px-1">
            {language === 'tr' ? 'Dil' : 'Language'}
          </span>
          <div
            className="relative flex items-center bg-muted rounded-full p-0.5 h-8 cursor-pointer select-none"
            onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
            onTouchStart={langSwitch.onTouchStart}
            onTouchMove={langSwitch.onTouchMove}
            onTouchEnd={langSwitch.onTouchEnd}
          >
            <div
              className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-landing-purple shadow-md
                         transition-transform duration-300 ease-out pointer-events-none"
              style={{ transform: language === 'en' ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
            />
            <div
              className={`relative z-10 flex-1 flex items-center justify-center gap-1 text-xs font-medium
                         rounded-full h-full transition-colors duration-300 pointer-events-none
                         ${language === 'tr' ? 'text-white' : 'text-muted-foreground'}`}
            >
              <span className="text-sm">🇹🇷</span>
              <span>TR</span>
            </div>
            <div
              className={`relative z-10 flex-1 flex items-center justify-center gap-1 text-xs font-medium
                         rounded-full h-full transition-colors duration-300 pointer-events-none
                         ${language === 'en' ? 'text-white' : 'text-muted-foreground'}`}
            >
              <span className="text-sm">🇬🇧</span>
              <span>EN</span>
            </div>
          </div>
        </div>

        {/* Theme Switch */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground px-1">
            {language === 'tr' ? 'Tema' : 'Theme'}
          </span>
          <div
            onClick={toggleTheme}
            onTouchStart={themeSwitch.onTouchStart}
            onTouchMove={themeSwitch.onTouchMove}
            onTouchEnd={themeSwitch.onTouchEnd}
            className="relative flex items-center w-full bg-muted rounded-full p-0.5 h-8 cursor-pointer select-none"
          >
            <div
              className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full shadow-md
                         transition-all duration-300 ease-out pointer-events-none
                         ${visualDark
                           ? 'bg-slate-700'
                           : 'bg-gradient-to-r from-amber-300 to-orange-300'
                         }`}
              style={{ transform: visualDark ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
            />
            <div
              className={`relative z-10 flex-1 flex items-center justify-center transition-colors duration-300 pointer-events-none
                         ${!visualDark ? 'text-amber-900' : 'text-muted-foreground'}`}
            >
              <Sun className="h-3.5 w-3.5" />
            </div>
            <div
              className={`relative z-10 flex-1 flex items-center justify-center transition-colors duration-300 pointer-events-none
                         ${visualDark ? 'text-blue-100' : 'text-muted-foreground'}`}
            >
              <Moon className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Login Button */}
        <button
          onClick={() => {
            setOpen(false);
            navigate('/login');
          }}
          className="w-full flex items-center justify-center gap-1.5 h-8 rounded-full
                     bg-gradient-to-r from-landing-purple/90 to-landing-purple
                     text-white font-medium text-xs
                     hover:from-landing-purple hover:to-landing-purple/90
                     hover:shadow-[0_4px_16px_rgba(147,112,219,0.4)]
                     active:scale-[0.98] transition-all duration-200"
        >
          <LogIn className="h-3.5 w-3.5" />
          {t.header.login[language]}
        </button>
      </PopoverContent>
    </Popover>
  );
}
