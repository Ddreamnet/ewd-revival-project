import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Sağ alt köşedeki "ücretsiz deneme dersi" sticker'ı — bileşen kütüphanesindeki
 * döndürülmüş sticker kart deseni. İletişim bölümü göründüğünde kendini gizler.
 */
export function StickyBubble() {
  const { language, t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Hero'dan sonra belir, iletişim bölümüne varınca çekil.
  useEffect(() => {
    const contact = document.getElementById('contact');

    const onScroll = () => {
      const pastHero = window.scrollY > 340;
      const atContact = contact ? contact.getBoundingClientRect().top < window.innerHeight * 0.9 : false;
      setVisible(pastHero && !atContact);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-3 z-40 transition-all duration-300 sm:bottom-6 sm:right-6"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.92)',
      }}
      aria-hidden={!visible}
    >
      <div
        className="pointer-events-auto relative w-[132px] rounded-[22px] border-2 px-2.5 pb-2.5 pt-0 sm:w-[146px]"
        style={{
          background: '#EFE1FB',
          borderColor: '#F0C4DC',
          transform: 'rotate(5deg)',
          boxShadow: '0 14px 22px -12px rgba(46,16,101,0.5)',
        }}
      >
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Kapat"
          className="absolute -right-1.5 -top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full border-2 bg-white text-[#6B5B7B] transition-colors hover:text-[#2E1065]"
          style={{ borderColor: '#F0C4DC' }}
        >
          <X className="h-2.5 w-2.5" />
        </button>

        <img
          src="/ewd/assets/ic/gift.png"
          alt=""
          aria-hidden="true"
          className="mx-auto -mt-[20px] w-[52px] sm:w-[58px]"
          style={{ filter: 'drop-shadow(0 6px 10px rgba(46,16,101,0.28))' }}
        />

        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#9B3E62]">
            {t.stickyBubble.line1[language]}
          </span>
          <span className="text-[14px] font-black leading-[1.05] tracking-[-0.01em] text-[#2E1065] sm:text-[15px]">
            {t.stickyBubble.line2[language]}
            <br />
            {t.stickyBubble.line3[language]}
          </span>
          <button
            type="button"
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            className="ewd-btn ewd-btn--purple mt-1.5 w-full !px-2 !py-2.5 !text-[10px] !leading-tight"
          >
            {t.stickyBubble.cta[language]}
          </button>
        </div>
      </div>
    </div>
  );
}
