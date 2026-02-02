import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

type BubbleType = 'trial' | 'contact' | 'none';

export function StickyBubble() {
  const { language, t } = useLanguage();
  const [bubbleType, setBubbleType] = useState<BubbleType>('trial');

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.getElementById('hero');
      const whySection = document.getElementById('why');
      const kidsSection = document.getElementById('kids-packages');
      const adultSection = document.getElementById('adult-packages');
      const faqSection = document.getElementById('faq');
      const contactSection = document.getElementById('contact');

      if (!heroSection || !contactSection) return;

      const scrollY = window.scrollY + window.innerHeight / 2;
      
      const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
      const whyBottom = whySection ? whySection.offsetTop + whySection.offsetHeight : heroBottom;
      const contactTop = contactSection.offsetTop;

      // Determine which bubble to show based on scroll position
      if (scrollY < whyBottom) {
        // Hero or Why section - show trial bubble
        setBubbleType('trial');
      } else if (scrollY < contactTop) {
        // Kids, Adult, or FAQ sections - show contact image
        setBubbleType('contact');
      } else {
        // Contact section - hide all
        setBubbleType('none');
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToContact = () => {
    const element = document.getElementById('contact');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (bubbleType === 'none') return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 pb-safe">
      {bubbleType === 'trial' && (
        <button
          onClick={scrollToContact}
          className="relative group"
        >
          {/* Chat bubble shape */}
          <div className="bg-landing-yellow shadow-xl rounded-2xl p-4 md:p-5 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <div className="text-center">
              <p className="text-sm md:text-base font-bold text-foreground leading-tight">
                {t.stickyBubble.line1[language]}
              </p>
              <p className="text-sm md:text-base font-bold text-foreground leading-tight">
                {t.stickyBubble.line2[language]}
              </p>
              <p className="text-sm md:text-base font-bold text-foreground leading-tight">
                {t.stickyBubble.line3[language]}
              </p>
            </div>
            {/* Bubble tail */}
            <div className="absolute -bottom-2 right-4 w-4 h-4 bg-landing-yellow transform rotate-45" />
          </div>
        </button>
      )}

      {bubbleType === 'contact' && (
        <button
          onClick={scrollToContact}
          className="transform transition-all duration-300 hover:scale-105"
        >
          <img
            src="/uploads/stickycontact.png"
            alt="Contact"
            className="w-[clamp(170px,25vw,280px)] h-auto drop-shadow-xl"
          />
        </button>
      )}
    </div>
  );
}
