import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Gift, ArrowRight, Sparkles } from 'lucide-react';

type BubbleType = 'trial' | 'contact' | 'none';

// Sparkle component for floating decorations
const FloatingSparkle = ({ delay, position }: { delay: string; position: string }) => (
  <span
    className={`absolute ${position} text-landing-yellow-light animate-sparkle`}
    style={{ animationDelay: delay }}
  >
    <Sparkles className="w-2 h-2 md:w-3 md:h-3" />
  </span>
);

export function StickyBubble() {
  const { language, t } = useLanguage();
  const [bubbleType, setBubbleType] = useState<BubbleType>('trial');
  const [displayedBubble, setDisplayedBubble] = useState<BubbleType>('trial');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const kidsPackagesSection = document.getElementById('kids-packages');
      const contactSection = document.getElementById('contact');

      if (!contactSection) return;

      const scrollY = window.scrollY + window.innerHeight * 0.4;
      const contactTop = contactSection.offsetTop;

      if (kidsPackagesSection) {
        const kidsPackagesTop = kidsPackagesSection.offsetTop;

        if (scrollY < kidsPackagesTop) {
          setBubbleType('trial');
        } else if (scrollY < contactTop) {
          setBubbleType('contact');
        } else {
          setBubbleType('none');
        }
      } else {
        // Fallback if kids-packages section doesn't exist
        if (scrollY < contactTop) {
          setBubbleType('trial');
        } else {
          setBubbleType('none');
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle smooth transition between bubbles
  useEffect(() => {
    if (bubbleType !== displayedBubble && !isTransitioning) {
      // Clear any existing timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      setIsTransitioning(true);

      // Wait for exit animation to complete, then switch bubble
      transitionTimeoutRef.current = setTimeout(() => {
        setDisplayedBubble(bubbleType);
        setIsTransitioning(false);
      }, 300);
    }

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [bubbleType, displayedBubble, isTransitioning]);

  const scrollToContact = () => {
    const element = document.getElementById('contact');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Don't render anything if both target and current are 'none'
  if (displayedBubble === 'none' && bubbleType === 'none') return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 pb-safe">
      <div
        className={`transform-gpu ${
          isTransitioning ? 'animate-bubble-exit' : 'animate-bubble-enter'
        }`}
      >
        {displayedBubble === 'trial' && (
          <button
            onClick={scrollToContact}
            className="relative group"
          >
            {/* Floating sparkles around the bubble */}
            <FloatingSparkle delay="0s" position="-top-2 -left-2" />
            <FloatingSparkle delay="0.5s" position="-top-1 -right-3" />
            <FloatingSparkle delay="1s" position="-bottom-2 -left-1" />
            <FloatingSparkle delay="1.5s" position="bottom-4 -right-4" />

            {/* Main card with glow effect - 75% size */}
            <div className="relative bg-gradient-to-br from-landing-yellow via-landing-pink to-landing-purple 
                            rounded-2xl p-3 md:p-4 
                            animate-glow-pulse
                            transform transition-all duration-300 
                            group-hover:scale-105 group-hover:shadow-2xl
                            overflow-hidden">
              
              {/* Shimmer overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                              -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

              {/* Gift icon with wiggle */}
              <div className="flex justify-center mb-1.5">
                <Gift className="w-6 h-6 md:w-8 md:h-8 text-landing-purple-dark animate-wiggle" />
              </div>

              {/* Text content */}
              <div className="text-center space-y-0">
                {/* "ÜCRETSİZ" - Gradient animated text */}
                <p className="text-base md:text-lg font-black 
                             bg-gradient-to-r from-landing-purple-dark via-landing-pink to-landing-purple-dark 
                             bg-[length:200%_auto] bg-clip-text text-transparent 
                             animate-gradient-shift
                             animate-pulse-scale">
                  {t.stickyBubble.line1[language]}
                </p>
                
                {/* "Deneme" - Gentle bounce with delay */}
                <p className="text-sm md:text-base font-bold text-foreground animate-bounce-gentle"
                   style={{ animationDelay: '0.2s' }}>
                  {t.stickyBubble.line2[language]}
                </p>
                
                {/* "Dersi!" - Gentle bounce with more delay */}
                <p className="text-sm md:text-base font-bold text-foreground animate-bounce-gentle"
                   style={{ animationDelay: '0.4s' }}>
                  {t.stickyBubble.line3[language]}
                </p>

                {/* CTA with arrow */}
                <div className="flex items-center justify-center gap-1 pt-1.5 text-xs md:text-sm font-semibold text-landing-purple-dark
                                opacity-80 group-hover:opacity-100 transition-opacity">
                  <span>{t.stickyBubble.cta[language]}</span>
                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4 animate-arrow-bounce" />
                </div>
              </div>

              {/* Bubble tail */}
              <div className="absolute -bottom-1.5 right-3 w-3 h-3 
                              bg-gradient-to-br from-landing-pink to-landing-purple 
                              transform rotate-45" />
            </div>
          </button>
        )}

        {displayedBubble === 'contact' && (
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
    </div>
  );
}
