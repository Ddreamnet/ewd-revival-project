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

// Trial bubble component
const TrialBubble = ({ onClick, language, t }: { onClick: () => void; language: 'tr' | 'en'; t: any }) => (
  <button onClick={onClick} className="relative group">
    {/* Floating sparkles around the bubble */}
    <FloatingSparkle delay="0s" position="-top-2 -left-2" />
    <FloatingSparkle delay="0.5s" position="-top-1 -right-3" />
    <FloatingSparkle delay="1s" position="-bottom-2 -left-1" />
    <FloatingSparkle delay="1.5s" position="bottom-4 -right-4" />

    {/* Main card with glow effect */}
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
        <p className="text-base md:text-lg font-black 
                     bg-gradient-to-r from-landing-purple-dark via-landing-pink to-landing-purple-dark 
                     bg-[length:200%_auto] bg-clip-text text-transparent 
                     animate-gradient-shift
                     animate-pulse-scale">
          {t.stickyBubble.line1[language]}
        </p>
        
        <p className="text-sm md:text-base font-bold text-foreground animate-bounce-gentle"
           style={{ animationDelay: '0.2s' }}>
          {t.stickyBubble.line2[language]}
        </p>
        
        <p className="text-sm md:text-base font-bold text-foreground animate-bounce-gentle"
           style={{ animationDelay: '0.4s' }}>
          {t.stickyBubble.line3[language]}
        </p>

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
);

// Contact bubble component
const ContactBubble = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="transform transition-all duration-300 hover:scale-105"
  >
    <img
      src="/uploads/stickycontact.png"
      alt="Contact"
      className="w-[clamp(170px,25vw,280px)] h-auto drop-shadow-xl"
    />
  </button>
);

export function StickyBubble() {
  const { language, t } = useLanguage();
  
  // Simplified state machine: 3 states only
  const [targetBubble, setTargetBubble] = useState<BubbleType>('trial');
  const [visibleBubble, setVisibleBubble] = useState<BubbleType>('trial');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Single ref for cleanup
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll detection with requestAnimationFrame throttling
  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      // Throttle with RAF - skip if already pending
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        const kidsPackages = document.getElementById('kids-packages');
        const contact = document.getElementById('contact');

        if (!kidsPackages || !contact) {
          rafId = null;
          return;
        }

        const viewportCenter = window.innerHeight / 2;
        const kidsTop = kidsPackages.getBoundingClientRect().top;
        const contactTop = contact.getBoundingClientRect().top;

        let newType: BubbleType;
        if (contactTop < viewportCenter) {
          newType = 'none';
        } else if (kidsTop < viewportCenter) {
          newType = 'contact';
        } else {
          newType = 'trial';
        }

        setTargetBubble(newType);
        rafId = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Transition handler with proper cleanup
  useEffect(() => {
    // Same bubble type - no transition needed
    if (targetBubble === visibleBubble) {
      return;
    }

    // Clear any pending transition
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    // Start exit transition
    setIsTransitioning(true);

    // After exit animation duration, switch bubble
    transitionTimeoutRef.current = setTimeout(() => {
      setVisibleBubble(targetBubble);

      // Use RAF to ensure state update is rendered before removing transition class
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(false);
        });
      });
    }, 300); // Exit animation duration

    // Cleanup on unmount or dependency change
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [targetBubble, visibleBubble]);

  const scrollToContact = () => {
    const element = document.getElementById('contact');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Don't render if both target and visible are 'none'
  if (visibleBubble === 'none' && targetBubble === 'none') {
    return null;
  }

  // Container classes based on transition state
  const containerClasses = isTransitioning
    ? 'opacity-0 scale-75'
    : 'opacity-100 scale-100';

  return (
    <div 
      className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 pb-safe"
      style={{ 
        willChange: 'opacity, transform',
        transform: 'translateZ(0)' // Force GPU layer
      }}
    >
      <div 
        className={`transition-all duration-300 ease-out ${containerClasses}`}
        style={{ transformOrigin: 'center center' }}
      >
        {visibleBubble === 'trial' && (
          <TrialBubble onClick={scrollToContact} language={language} t={t} />
        )}
        {visibleBubble === 'contact' && (
          <ContactBubble onClick={scrollToContact} />
        )}
      </div>
    </div>
  );
}
