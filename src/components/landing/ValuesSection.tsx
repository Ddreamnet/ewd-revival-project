import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import img1 from "@/assets/values-1.jpg";
import img2 from "@/assets/values-2.jpg";
import img3 from "@/assets/values-3.jpg";
import img4 from "@/assets/values-4.jpg";
import img5 from "@/assets/values-5.jpg";
import signatureImg from "@/assets/ataturk-signature.png";
import { useTranslation } from "@/contexts/LanguageContext";

const CARDS = [
{
  id: 1,
  image: img1,
  quote: {
    tr: "Eğitimdir ki bir milleti ya hür, bağımsız, şanlı, yüksek bir topluluk halinde yaşatır; ya da esaret ve sefalete terk eder.",
    en: "It is education that either enables a nation to live as a free, independent, honoured and elevated community, or abandons it to bondage and misery."
  }
},
{
  id: 2,
  image: img2,
  quote: {
    tr: "Küçük hanımlar, küçük beyler! Sizler hepiniz geleceğin bir gülü, yıldızı ve ikbal ışığısınız. Memleketi asıl ışığa boğacak olan sizsiniz. Kendinizin ne kadar önemli, değerli olduğunuzu düşünerek ona göre çalışınız. Sizlerden çok şey bekliyoruz.",
    en: "Little ladies, little gentlemen! You are all the roses, the stars, and the bright promise of the future. It is you who will bathe our country in true light. Be mindful of how important and valuable you are, and work accordingly. We expect great things from you."
  }
},
{
  id: 3,
  image: img3,
  quote: {
    tr: "Çocuklar geleceğimizin güvencesi, yaşama sevincimizdir. Bugünün çocuğunu, yarının büyüğü olarak yetiştirmek hepimizin insanlık görevidir.",
    en: "Children are the guarantee of our future and the joy of our lives. To raise today's child as tomorrow's adult is a duty of humanity that belongs to us all."
  }
},
{
  id: 4,
  image: img4,
  quote: {
    tr: "Bugünün küçükleri yarının büyükleridir.",
    en: "Today's little ones are tomorrow's great ones."
  }
},
{
  id: 5,
  image: img5,
  quote: {
    tr: "Öğretmenler, Cumhuriyet sizden fikri hür, vicdanı hür, irfanı hür nesiller ister.",
    en: "Teachers, the Republic asks of you generations who are free in thought, free in conscience, and free in learning."
  }
}];


const TOTAL = CARDS.length;

function mod(n: number, m: number) {
  return (n % m + m) % m;
}

export function ValuesSection() {
  const { language } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDelta = useRef(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (animating) return;
      setAnimating(true);
      setActiveIndex((prev) => mod(prev + dir, TOTAL));
      setTimeout(() => setAnimating(false), 400);
    },
    [animating]
  );

  // Touch events for mobile app compatibility (works in Capacitor)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDelta.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchDelta.current = e.touches[0].clientX - touchStartX.current;
  };

  const onTouchEnd = () => {
    if (Math.abs(touchDelta.current) > 40) {
      go(touchDelta.current < 0 ? 1 : -1);
    }
    touchDelta.current = 0;
  };

  // Mouse drag for desktop
  const mouseDown = useRef(false);
  const mouseStartX = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    mouseDown.current = true;
    mouseStartX.current = e.clientX;
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!mouseDown.current) return;
    mouseDown.current = false;
    const diff = e.clientX - mouseStartX.current;
    if (Math.abs(diff) > 40) {
      go(diff < 0 ? 1 : -1);
    }
  };

  const onMouseLeave = () => {
    mouseDown.current = false;
  };

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go]);

  // Desktop: 3D carousel positions
  const getCardProps = (cardIndex: number) => {
    const offset = mod(cardIndex - activeIndex + Math.floor(TOTAL / 2), TOTAL) - Math.floor(TOTAL / 2);
    const abs = Math.abs(offset);
    const isCenter = offset === 0;
    const isAdjacent = abs === 1;
    const isFar = abs === 2;

    let translateX = "0px";
    let scale = 1;
    let opacity = 1;
    let zIndex = 10;
    let blur = "blur(0px)";

    if (isMobile) {
      // Mobile: only show center card
      if (isCenter) {
        translateX = "0px"; scale = 1; opacity = 1; zIndex = 20; blur = "blur(0px)";
      } else {
        // Hide all non-center cards off-screen
        translateX = offset > 0 ? "120%" : "-120%";
        scale = 0.85; opacity = 0; zIndex = 1; blur = "blur(0px)";
      }
    } else {
      // Desktop: keep 3D carousel
      if (isCenter) {
        translateX = "0px"; scale = 1; opacity = 1; zIndex = 20; blur = "blur(0px)";
      } else if (isAdjacent) {
        translateX = offset > 0 ? "70%" : "-70%";
        scale = 0.84; opacity = 0.5; zIndex = 10; blur = "blur(1px)";
      } else if (isFar) {
        translateX = offset > 0 ? "130%" : "-130%";
        scale = 0.7; opacity = 0.25; zIndex = 5; blur = "blur(2px)";
      } else {
        translateX = offset > 0 ? "200%" : "-200%";
        scale = 0.6; opacity = 0; zIndex = 1; blur = "blur(3px)";
      }
    }

    return { translateX, scale, opacity, zIndex, blur, isCenter };
  };

  // Shared arrow button component
  const ArrowButton = ({ direction, className: extraClass }: { direction: -1 | 1; className?: string }) => (
    <button
      onClick={() => go(direction)}
      aria-label={direction === -1 ? "Önceki" : "Sonraki"}
      className={`z-30 w-11 h-11 rounded-full bg-landing-purple shadow-lg flex items-center justify-center hover:bg-landing-purple-dark hover:shadow-xl transition-all active:scale-95 ${extraClass ?? ""}`}
    >
      {direction === -1 ? (
        <ChevronLeft className="h-6 w-6 text-white" />
      ) : (
        <ChevronRight className="h-6 w-6 text-white" />
      )}
    </button>
  );

  return (
    <section id="values" className="scroll-section py-16 md:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-landing-purple-dark">
            {language === "tr" ? "Değerlerimiz" : "Our Values"}
          </h2>
        </div>

        {/* Carousel stage */}
        <div className="relative" style={{ height: "clamp(380px, 90vw, 640px)" }}>
          {/* Cards */}
          <div
            ref={containerRef}
            className="absolute inset-0 flex items-center justify-center select-none cursor-grab active:cursor-grabbing overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          >
            {CARDS.map((card, cardIndex) => {
              const { translateX, scale, opacity, zIndex, blur, isCenter } = getCardProps(cardIndex);

              return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (!isCenter && !animating) {
                      const offset =
                        mod(cardIndex - activeIndex + Math.floor(TOTAL / 2), TOTAL) - Math.floor(TOTAL / 2);
                      if (offset !== 0) go(offset > 0 ? 1 : -1);
                    }
                  }}
                  style={{
                    position: "absolute",
                    transform: `translateX(${translateX}) scale(${scale})`,
                    opacity,
                    zIndex,
                    filter: blur,
                    transition: "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease, filter 0.4s ease",
                    width: "clamp(220px, 75vw, 420px)",
                    maxWidth: "420px",
                    cursor: isCenter ? "grab" : "pointer",
                    pointerEvents: isMobile && !isCenter ? "none" : "auto",
                  }}
                >
                  {/* Outer card frame */}
                  <div
                    className="rounded-3xl bg-white/90 dark:bg-card/90 shadow-xl overflow-hidden"
                    style={{
                      boxShadow: isCenter
                        ? "0 20px 60px -10px rgba(180,100,160,0.25), 0 8px 24px -4px rgba(180,100,160,0.15)"
                        : "0 8px 24px -8px rgba(0,0,0,0.12)",
                    }}
                  >
                    {/* Inner dashed border */}
                    <div className="m-[5px] rounded-[18px] border border-dashed border-landing-purple/30 overflow-hidden">
                      {/* Image area */}
                      <div className="w-full overflow-hidden bg-muted" style={{ aspectRatio: "4/3" }}>
                        <img
                          src={card.image}
                          alt={`Değer ${card.id}`}
                          loading="lazy"
                          width={420}
                          height={315}
                          className="w-full h-full object-cover grayscale"
                          draggable={false}
                        />
                      </div>

                      {/* Quote area */}
                      <div className="px-5 pt-4 pb-5 bg-gradient-to-b from-white/80 to-landing-pink/20">
                        <span
                          className="text-landing-purple-dark/30 font-serif leading-none select-none"
                          style={{ fontSize: "3rem", lineHeight: 1 }}
                          aria-hidden
                        >
                          "
                        </span>
                        <p className="text-foreground/80 text-sm leading-relaxed -mt-2 italic font-medium">
                          {card.quote[language]}"
                        </p>
                        <div className="mt-4 flex justify-end items-center">
                          <img
                            src={signatureImg}
                            alt="Mustafa Kemal Atatürk imzası"
                            loading="lazy"
                            width={160}
                            height={52}
                            className="h-10 w-auto object-contain opacity-75"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Arrow buttons – both mobile and desktop */}
          <ArrowButton direction={-1} className="absolute left-2 md:left-0 top-1/2 -translate-y-1/2" />
          <ArrowButton direction={1} className="absolute right-2 md:right-0 top-1/2 -translate-y-1/2" />
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {CARDS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (animating) return;
                const diff = mod(i - activeIndex + Math.floor(TOTAL / 2), TOTAL) - Math.floor(TOTAL / 2);
                if (diff !== 0) {
                  setAnimating(true);
                  setActiveIndex(i);
                  setTimeout(() => setAnimating(false), 400);
                }
              }}
              aria-label={`Kart ${i + 1}`}
              className={`transition-all duration-300 rounded-full h-2 ${
                i === activeIndex ? "w-6 bg-landing-purple-dark" : "w-2 bg-landing-purple/35"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
