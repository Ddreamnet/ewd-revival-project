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

// Burst particles for transition effect - CSS only, no state dependency
const BurstParticles = ({ show }: { show: boolean }) => {
  const particles = [
    { tx: 60, ty: 0, color: 'hsl(330, 85%, 86%)' },
    { tx: 42, ty: 42, color: 'hsl(280, 50%, 75%)' },
    { tx: 0, ty: 60, color: 'hsl(45, 93%, 58%)' },
    { tx: -42, ty: 42, color: 'hsl(330, 85%, 86%)' },
    { tx: -60, ty: 0, color: 'hsl(45, 85%, 75%)' },
    { tx: -42, ty: -42, color: 'hsl(280, 50%, 75%)' },
    { tx: 0, ty: -60, color: 'hsl(330, 85%, 86%)' },
    { tx: 42, ty: -42, color: 'hsl(45, 93%, 58%)' },
  ];

  return (
    <div 
      className={`absolute inset-0 pointer-events-none overflow-visible z-50 transition-opacity duration-200
                  ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      {particles.map((particle, i) => (
        <span
          key={i}
          className={`absolute w-3 h-3 rounded-full ${show ? 'animate-burst-particle' : ''}`}
          style={{
            '--tx': `${particle.tx}px`,
            '--ty': `${particle.ty}px`,
            background: particle.color,
            left: '50%',
            top: '50%',
            boxShadow: `0 0 10px ${particle.color}`,
          } as React.CSSProperties}
        />
      ))}
      {/* Center glow effect */}
      <div 
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                    w-20 h-20 rounded-full 
                    bg-gradient-to-r from-landing-yellow via-landing-pink to-landing-purple
                    ${show ? 'animate-glow-trail' : 'opacity-0'}`}
      />
    </div>
  );
};

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
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'exiting' | 'entering'>('idle');
  
  // Single ref for cleanup
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll detection with requestAnimationFrame throttling
  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
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
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Transition handler with animations
  useEffect(() => {
    if (targetBubble === visibleBubble) {
      return;
    }

    // Clear any pending transition
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    // Start exit animation
    setAnimationPhase('exiting');

    // After exit, switch bubble and start entry animation
    transitionTimeoutRef.current = setTimeout(() => {
      setVisibleBubble(targetBubble);
      setAnimationPhase('entering');

      // After entry animation, go to idle
      transitionTimeoutRef.current = setTimeout(() => {
        setAnimationPhase('idle');
      }, 400);
    }, 350);

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

  // Don't render if both target and visible are 'none' and not animating
  if (visibleBubble === 'none' && targetBubble === 'none' && animationPhase === 'idle') {
    return null;
  }

  // Get animation class based on phase and bubble type
  const getAnimationClass = () => {
    if (animationPhase === 'idle') return 'animate-floating';
    
    if (animationPhase === 'exiting') {
      return visibleBubble === 'trial' ? 'animate-magic-pop-out' : 'animate-flip-out-y';
    }
    
    if (animationPhase === 'entering') {
      return visibleBubble === 'trial' ? 'animate-magic-pop-in' : 'animate-flip-in-y';
    }
    
    return '';
  };

  return (
    <div 
      className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 pb-safe"
      style={{ 
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}
    >
      <div className="relative">
        {/* Burst particles during exit transition */}
        <BurstParticles show={animationPhase === 'exiting'} />

        <div 
          className={`${getAnimationClass()}`}
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
    </div>
  );
}
