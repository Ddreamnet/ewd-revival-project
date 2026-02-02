import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Gift, ArrowRight, Sparkles } from 'lucide-react';

type BubbleType = 'trial' | 'contact' | 'none';
type AnimationState = 'idle' | 'exiting' | 'entering';

// Sparkle component for floating decorations
const FloatingSparkle = ({ delay, position }: { delay: string; position: string }) => (
  <span
    className={`absolute ${position} text-landing-yellow-light animate-sparkle`}
    style={{ animationDelay: delay }}
  >
    <Sparkles className="w-2 h-2 md:w-3 md:h-3" />
  </span>
);

// Burst particles for transition effect
const BurstParticles = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;

  const particles = [
    { tx: 60, ty: 0, color: 'hsl(330, 85%, 86%)' },      // pink
    { tx: 42, ty: 42, color: 'hsl(280, 50%, 75%)' },     // purple
    { tx: 0, ty: 60, color: 'hsl(45, 93%, 58%)' },       // yellow
    { tx: -42, ty: 42, color: 'hsl(330, 85%, 86%)' },    // pink
    { tx: -60, ty: 0, color: 'hsl(45, 85%, 75%)' },      // light yellow
    { tx: -42, ty: -42, color: 'hsl(280, 50%, 75%)' },   // purple
    { tx: 0, ty: -60, color: 'hsl(330, 85%, 86%)' },     // pink
    { tx: 42, ty: -42, color: 'hsl(45, 93%, 58%)' },     // yellow
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
      {particles.map((particle, i) => (
        <span
          key={i}
          className="absolute w-3 h-3 rounded-full animate-burst-particle"
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
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                   w-20 h-20 rounded-full animate-glow-trail
                   bg-gradient-to-r from-landing-yellow via-landing-pink to-landing-purple"
      />
    </div>
  );
};

export function StickyBubble() {
  const { language, t } = useLanguage();
  const [bubbleType, setBubbleType] = useState<BubbleType>('trial');
  const [displayBubble, setDisplayBubble] = useState<BubbleType>('trial');
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [showParticles, setShowParticles] = useState(false);
  const previousBubble = useRef<BubbleType>('trial');
  const isAnimating = useRef(false);

  // Simple scroll-based section detection
  useEffect(() => {
    const handleScroll = () => {
      const kidsPackagesSection = document.getElementById('kids-packages');
      const contactSection = document.getElementById('contact');

      if (!kidsPackagesSection || !contactSection) return;

      const kidsRect = kidsPackagesSection.getBoundingClientRect();
      const contactRect = contactSection.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;

      if (contactRect.top < viewportCenter) {
        setBubbleType('none');
      } else if (kidsRect.top < viewportCenter) {
        setBubbleType('contact');
      } else {
        setBubbleType('trial');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle bubble transitions with animations
  useEffect(() => {
    if (bubbleType !== previousBubble.current && !isAnimating.current) {
      isAnimating.current = true;
      
      // Start exit animation
      setAnimationState('exiting');
      setShowParticles(true);

      // After exit animation, switch bubble and start enter animation
      const exitTimeout = setTimeout(() => {
        setShowParticles(false);
        setDisplayBubble(bubbleType);
        setAnimationState('entering');

        // After enter animation, go back to idle
        const enterTimeout = setTimeout(() => {
          setAnimationState('idle');
          isAnimating.current = false;
        }, 600);

        return () => clearTimeout(enterTimeout);
      }, 400);

      previousBubble.current = bubbleType;
      return () => clearTimeout(exitTimeout);
    }
  }, [bubbleType]);

  const scrollToContact = () => {
    const element = document.getElementById('contact');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Get animation class based on current state and bubble type
  const getAnimationClass = () => {
    if (animationState === 'idle') return '';
    
    if (displayBubble === 'trial') {
      return animationState === 'exiting' ? 'animate-magic-pop-out' : 'animate-magic-pop-in';
    } else if (displayBubble === 'contact') {
      return animationState === 'exiting' ? 'animate-flip-out-y' : 'animate-flip-in-y';
    }
    return '';
  };

  if (displayBubble === 'none' && animationState === 'idle') return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 pb-safe">
      <div className="relative">
        {/* Burst particles during transition */}
        <BurstParticles isActive={showParticles} />

        <div className={`transition-all duration-300 ease-in-out ${getAnimationClass()}`}>
          {displayBubble === 'trial' && (
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
          )}

          {displayBubble === 'contact' && (
            <button
              onClick={scrollToContact}
              className="transform transition-all duration-300 hover:scale-105"
              style={{ transformStyle: 'preserve-3d' }}
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
    </div>
  );
}
