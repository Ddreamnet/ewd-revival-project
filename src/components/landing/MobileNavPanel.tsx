import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Menu, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANGUAGES } from '@/lib/translations';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Masaüstündeki nav pill'lerinin mobil karşılığı. */
const ITEMS = [
  { id: 'kids-packages', key: 'lessons', badge: 'nav-dersler.svg', to: null },
  { id: 'words', key: 'words', badge: 'ic-abc.svg', to: null },
  { id: 'contact', key: 'contact', badge: 'nav-iletisim.svg', to: null },
  { id: 'blog', key: 'blog', badge: 'nav-blog.svg', to: '/blog' },
] as const;

interface MobileNavPanelProps {
  /** Ana sayfadaki bir bölüme kaydırır. */
  onNavigateSection: (id: string) => void;
}

export function MobileNavPanel({ onNavigateSection }: MobileNavPanelProps) {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const go = (item: (typeof ITEMS)[number]) => {
    setOpen(false);
    if (item.to) navigate(item.to);
    else onNavigateSection(item.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="ewd-iconbtn lg:hidden" aria-label={t.header.menu[language]}>
          {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={12}
        className="z-[70] w-[268px] space-y-3 rounded-[28px] border-[3px] p-3.5"
        style={{
          background: 'var(--ewd-cream-hi)',
          borderColor: 'var(--ewd-lilac-line)',
          boxShadow: '0 26px 44px -26px rgba(46,16,101,0.5)',
        }}
      >
        <nav className="flex flex-col gap-2">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item)}
              className="ewd-navpill w-full !justify-start"
            >
              <span className="ewd-navpill__badge">
                <img src={`/ewd/assets/ic/${item.badge}`} alt="" loading="lazy" />
              </span>
              {t.header[item.key][language]}
            </button>
          ))}
        </nav>

        <div className="space-y-1.5">
          <span className="px-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#7A6A8F]">
            {t.header.language[language]}
          </span>
          {/* Yedi dil bir pill şeridine sığmıyor; iki sütunlu bir ızgara hem
              adları yazacak yer bırakıyor hem de parmakla rahat seçiliyor. */}
          <div
            className="grid grid-cols-2 gap-1 rounded-[20px] p-1"
            style={{ background: 'var(--ewd-lilac-tint)' }}
          >
            {LANGUAGES.map((lang) => {
              const active = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  aria-pressed={active}
                  className="flex items-center gap-1.5 rounded-[16px] px-2 py-2 text-[12px] font-extrabold transition-colors"
                  style={
                    active
                      ? { background: 'var(--ewd-purple)', color: '#fff' }
                      : { color: 'var(--ewd-body-soft)' }
                  }
                >
                  <img
                    src={lang.flagIcon}
                    alt=""
                    aria-hidden="true"
                    className="ewd-flagdot h-[18px] w-[18px] shrink-0 rounded-full object-cover"
                  />
                  <span className="truncate">{lang.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate('/login');
          }}
          className="ewd-btn ewd-btn--purple ewd-btn--sm w-full"
        >
          <LogIn className="h-4 w-4" />
          {t.header.login[language]}
        </button>
      </PopoverContent>
    </Popover>
  );
}
