import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import img1 from "@/assets/values-1.jpg";
import img2 from "@/assets/values-2.jpg";
import img3 from "@/assets/values-3.jpg";
import img4 from "@/assets/values-4.jpg";
import img5 from "@/assets/values-5.jpg";
import signatureImg from "@/assets/ataturk-signature.png";

const CARDS = [
  {
    id: 1,
    image: img1,
    quote:
      "Eğitimdir ki bir milleti ya hür, bağımsız, şanlı, yüksek bir topluluk halinde yaşatır; ya da esaret ve sefalete terk eder.",
  },
  {
    id: 2,
    image: img2,
    quote:
      "Küçük hanımlar, küçük beyler! Sizler hepiniz geleceğin bir gülü, yıldızı ve ikbal ışığısınız. Memleketi asıl ışığa boğacak olan sizsiniz. Kendinizin ne kadar önemli, değerli olduğunuzu düşünerek ona göre çalışınız. Sizlerden çok şey bekliyoruz.",
  },
  {
    id: 3,
    image: img3,
    quote:
      "Çocuklar geleceğimizin güvencesi, yaşama sevincimizdir. Bugünün çocuğunu, yarının büyüğü olarak yetiştirmek hepimizin insanlık görevidir.",
  },
  {
    id: 4,
    image: img4,
    quote: "Bugünün küçükleri yarının büyükleridir.",
  },
  {
    id: 5,
    image: img5,
    quote: "Öğretmenler, Cumhuriyet sizden fikri hür, vicdanı hür, irfanı hür nesiller ister.",
  },
];

const TOTAL = CARDS.length;

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function ValuesSection() {
  // activeIndex = index of the card displayed in the CENTER
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (animating) return;
      setAnimating(true);
      setActiveIndex((prev) => mod(prev + dir, TOTAL));
      setTimeout(() => setAnimating(false), 400);
    },
    [animating],
  );

  // Pointer drag for swipe
  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setDragStartX(e.clientX);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    const diff = e.clientX - dragStartX;
    if (Math.abs(diff) > 40) {
      go(diff < 0 ? 1 : -1);
    }
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

  // Compute position class and styles for each card slot
  // slots: -2, -1, 0 (center), +1, +2
  const getCardProps = (cardIndex: number) => {
    const offset = mod(cardIndex - activeIndex + Math.floor(TOTAL / 2), TOTAL) - Math.floor(TOTAL / 2);
    // For 5 cards: offsets cycle through -2, -1, 0, 1, 2

    const abs = Math.abs(offset);
    const isCenter = offset === 0;
    const isAdjacent = abs === 1;
    const isFar = abs === 2;

    let translateX = "0px";
    let scale = 1;
    let opacity = 1;
    let zIndex = 10;
    let blur = "blur(0px)";

    if (isCenter) {
      translateX = "0px";
      scale = 1;
      opacity = 1;
      zIndex = 20;
      blur = "blur(0px)";
    } else if (isAdjacent) {
      translateX = offset > 0 ? "70%" : "-70%";
      scale = 0.84;
      opacity = 0.5;
      zIndex = 10;
      blur = "blur(1px)";
    } else if (isFar) {
      translateX = offset > 0 ? "130%" : "-130%";
      scale = 0.7;
      opacity = 0.25;
      zIndex = 5;
      blur = "blur(2px)";
    } else {
      // Hidden (for TOTAL > 5)
      translateX = offset > 0 ? "200%" : "-200%";
      scale = 0.6;
      opacity = 0;
      zIndex = 1;
      blur = "blur(3px)";
    }

    return { translateX, scale, opacity, zIndex, blur, isCenter };
  };

  return (
    <section id="values" className="scroll-section py-16 md:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-landing-purple-dark">Değerlerimiz</h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm md:text-base">
            Eğitime ve geleceğe duyduğumuz inancın temelleri
          </p>
        </div>

        {/* Carousel stage */}
        <div className="relative" style={{ height: "clamp(420px, 60vw, 640px)" }}>
          {/* Cards */}
          <div
            ref={containerRef}
            className="absolute inset-0 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDragging(false)}
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
                    transition: animating
                      ? "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease, filter 0.4s ease"
                      : "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease, filter 0.4s ease",
                    width: "clamp(260px, 38vw, 420px)",
                    maxWidth: "420px",
                    cursor: isCenter ? "grab" : "pointer",
                  }}
                >
                  {/* Outer card frame */}
                  <div
                    className="rounded-3xl bg-white/90 shadow-xl overflow-hidden"
                    style={{
                      boxShadow: isCenter
                        ? "0 20px 60px -10px rgba(180,100,160,0.25), 0 8px 24px -4px rgba(180,100,160,0.15)"
                        : "0 8px 24px -8px rgba(0,0,0,0.12)",
                    }}
                  >
                    {/* Inner dashed border (dikiş hissi) */}
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
                        {/* Open-quote icon */}
                        <span
                          className="text-landing-purple-dark/30 font-serif leading-none select-none"
                          style={{ fontSize: "3rem", lineHeight: 1 }}
                          aria-hidden
                        >
                          "
                        </span>
                        <p className="text-foreground/80 text-sm leading-relaxed -mt-2 italic font-medium">
                          {card.quote}"
                        </p>
                        {/* Signature area */}
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

          {/* Arrow buttons – desktop only */}
          <button
            onClick={() => go(-1)}
            aria-label="Önceki"
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/80 shadow-md items-center justify-center hover:bg-white hover:shadow-lg transition-all border border-landing-purple/20"
          >
            <ChevronLeft className="h-5 w-5 text-landing-purple-dark" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Sonraki"
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/80 shadow-md items-center justify-center hover:bg-white hover:shadow-lg transition-all border border-landing-purple/20"
          >
            <ChevronRight className="h-5 w-5 text-landing-purple-dark" />
          </button>
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
