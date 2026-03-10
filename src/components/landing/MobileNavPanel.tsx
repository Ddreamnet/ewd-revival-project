import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogIn, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';

export function MobileNavPanel() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isDark = theme === 'dark';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="md:hidden rounded-full p-2.5 bg-landing-purple/10 text-landing-purple-dark
                     hover:bg-landing-purple/20 hover:scale-110
                     hover:shadow-[0_0_12px_rgba(147,112,219,0.4)]
                     transition-all duration-300"
          aria-label="Menü"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-64 rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl
                   shadow-[0_8px_32px_rgba(147,112,219,0.15)] p-4 space-y-4 z-[70]"
      >
        {/* Language Switch */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground px-1">
            {language === 'tr' ? 'Dil' : 'Language'}
          </span>
          <div className="relative flex items-center bg-muted rounded-full p-1 h-11">
            {/* Sliding knob */}
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-landing-purple shadow-md
                         transition-transform duration-300 ease-out"
              style={{ transform: language === 'en' ? 'translateX(calc(100% + 8px))' : 'translateX(0)' }}
            />
            <button
              onClick={() => setLanguage('tr')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 text-sm font-medium
                         rounded-full h-full transition-colors duration-300
                         ${language === 'tr' ? 'text-white' : 'text-muted-foreground'}`}
            >
              <span className="text-base">🇹🇷</span>
              <span>TR</span>
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 text-sm font-medium
                         rounded-full h-full transition-colors duration-300
                         ${language === 'en' ? 'text-white' : 'text-muted-foreground'}`}
            >
              <span className="text-base">🇬🇧</span>
              <span>EN</span>
            </button>
          </div>
        </div>

        {/* Theme Switch */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground px-1">
            {language === 'tr' ? 'Tema' : 'Theme'}
          </span>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="relative flex items-center w-full bg-muted rounded-full p-1 h-11 cursor-pointer"
          >
            {/* Sliding knob */}
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-md
                         transition-all duration-300 ease-out
                         ${isDark
                           ? 'bg-slate-700 translate-x-[calc(100%+8px)]'
                           : 'bg-gradient-to-r from-amber-300 to-orange-300 translate-x-0'
                         }`}
            />
            <div
              className={`relative z-10 flex-1 flex items-center justify-center transition-colors duration-300
                         ${!isDark ? 'text-amber-900' : 'text-muted-foreground'}`}
            >
              <Sun className="h-4.5 w-4.5" />
            </div>
            <div
              className={`relative z-10 flex-1 flex items-center justify-center transition-colors duration-300
                         ${isDark ? 'text-blue-100' : 'text-muted-foreground'}`}
            >
              <Moon className="h-4.5 w-4.5" />
            </div>
          </button>
        </div>

        {/* Login Button */}
        <button
          onClick={() => {
            setOpen(false);
            navigate('/login');
          }}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-full
                     bg-gradient-to-r from-landing-purple/90 to-landing-purple
                     text-white font-medium text-sm
                     hover:from-landing-purple hover:to-landing-purple/90
                     hover:shadow-[0_4px_16px_rgba(147,112,219,0.4)]
                     active:scale-[0.98] transition-all duration-200"
        >
          <LogIn className="h-4 w-4" />
          {t.header.login[language]}
        </button>
      </PopoverContent>
    </Popover>
  );
}
