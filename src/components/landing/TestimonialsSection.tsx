import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSectionNav } from "@/hooks/useSectionNav";

/** Aktif kartın iki yanındaki kartların yatay kayması — kart genişliğinin oranı. */
const SIDE_SHIFT = "40.6%";

/** Özet rozetleri sırayla bu üç renge giriyor — aynı kartta iki aynı ton olmasın. */
const TAG_TONES = [
  { bg: "#FFF1F7", ink: "#BE185D", line: "#F8C8DC" },
  { bg: "#FEF3C7", ink: "#6B4A00", line: "#FBD34F" },
  { bg: "#F4EDFF", ink: "#5B21B6", line: "#C9B6F5" },
] as const;

/**
 * "Veli Yorumları" — solda başlık ve nokta navigasyonu, sağda deste karuseli:
 * ortada aktif yorum, iki yanında arkada duran yorumlar.
 *
 * Yorumlar WhatsApp mesajlarından kısaltılarak alındı; isim, saat ve sınıf
 * bilgisi gizlilik gereği çıkarıldı (bkz. `content/veli-yorumlari.md`).
 */
export function TestimonialsSection() {
  const { language, t } = useLanguage();
  const goToSection = useSectionNav();
  const items = t.testimonials.items;
  const [active, setActive] = useState(0);

  /* Dar ekranda yan kartlar aktif kartın üstüne biner; orada yalnız aktif kart durur. */
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setStacked(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const step = (delta: number) => setActive((i) => (i + delta + items.length) % items.length);
  const [beforeTrial, afterTrial] = t.testimonials.trial[language].split("|");

  return (
    <section
      id="testimonials"
      className="ewd-bulge-host scroll-section ewd-section relative px-5 sm:px-8"
      style={{ background: "#FFF8EF" }}
    >
      {/* Pembe çizgi deseni — bölümü kremden ayıran tek doku. Ölçü piksel
          cinsinden sabit: çıkıntıdaki doku da aynı ölçüyü kullanınca çizgiler
          dikişte kaymadan devam ediyor. */}
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.42]"
        style={{ backgroundImage: "url(/ewd/pat/b.webp)", backgroundSize: "941px 1672px" }}
        aria-hidden="true"
      />
      {/* Tarak geçiş — bölüm hem üstteki mor bloğa hem alttaki pembeye sarkar;
          diğer bölümlerdeki gibi zemin dokusunu da beraberinde götürür. */}
      <span className="ewd-bulge" style={{ ["--bulge" as string]: "#FFF8EF" }} aria-hidden="true">
        <span
          className="ewd-bulge__tex opacity-[0.42]"
          style={{ backgroundImage: "url(/ewd/pat/b.webp)", backgroundSize: "941px 1672px" }}
        />
      </span>
      <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 lg:grid-cols-[396px_1fr] lg:gap-14">
        {/* --------------------------------------------------------- sol kolon */}
        <div className="flex flex-col items-start gap-4">
          <span className="ewd-label rounded-full bg-[#A253BE] px-5 py-2.5 text-white">
            {t.testimonials.badge[language]}
          </span>

          <div className="flex flex-col items-start">
            <span className="text-[44px] font-black leading-[0.92] tracking-[-0.03em] text-[#2E1065] sm:text-[56px] lg:text-[66px]">
              {t.testimonials.title[language]}
            </span>
            <span className="ewd-script text-[56px] leading-[0.92] text-[#EC4899] sm:text-[70px] lg:text-[84px]">
              {t.testimonials.titleScript[language]}
            </span>
          </div>

          <p className="mt-1.5 max-w-[348px] text-[16px] font-semibold leading-[1.6] text-[#5B4A6E] [text-wrap:pretty] sm:text-[17px]">
            {t.testimonials.lead[language]}
          </p>

          <div className="flex items-center gap-2.5 pt-1">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${t.testimonials.goTo[language]} ${i + 1}`}
                aria-current={i === active}
                className="ewd-hit-44 h-2.5 rounded-full transition-[width,background-color] duration-[400ms]"
                style={{
                  width: i === active ? 34 : 12,
                  background: i === active ? "#EC4899" : "#E3CFE0",
                }}
              />
            ))}
          </div>

          {/* Ücretsiz deneme dersi — sayfadaki diğer çağrılar gibi iletişim
              formuna kaydırır; kart görünüşlüydü, tıklandığı belli olmuyordu. */}
          <button
            type="button"
            onClick={() => goToSection("contact")}
            aria-label={`${beforeTrial} ${afterTrial}`}
            className="group mt-3 flex items-center gap-4 rounded-full py-3.5 pl-4 pr-5 text-left transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: "#FFFDF8",
              border: "3px solid #F0DCE4",
              boxShadow: "0 10px 20px -14px rgba(46,16,101,0.35)",
            }}
          >
            <img src="/uploads/logo.webp" alt="" aria-hidden="true" className="h-[54px] w-auto" />
            <span className="text-[15px] font-extrabold leading-[1.3] text-[#2E1065] sm:text-[17px]">
              {beforeTrial}
              <br />
              {afterTrial}
            </span>
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-colors group-hover:bg-[#F25BA6]"
              style={{ background: "#EC4899" }}
              aria-hidden="true"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={3} />
            </span>
          </button>
        </div>

        {/* ------------------------------------------------- sağ kolon: deste */}
        <div className="relative">
          <div className="relative h-[452px] sm:h-[404px] lg:h-[368px]">
            {items.map((item, i) => {
              const distance = (i - active + items.length) % items.length;
              const layout = deckLayout(distance, stacked);
              return (
                <article
                  key={i}
                  aria-hidden={distance !== 0}
                  className="absolute left-1/2 top-0 flex h-full w-full max-w-[572px] flex-col gap-4 rounded-[36px] px-7 pb-7 pt-8 transition-[transform,opacity] duration-[550ms] [transition-timing-function:cubic-bezier(.22,1,.36,1)] sm:px-9"
                  style={{
                    background: "#FFFDF8",
                    border: "3px solid #EFDFF9",
                    boxShadow: "0 26px 44px -26px rgba(46,16,101,0.5)",
                    transform: layout.transform,
                    opacity: layout.opacity,
                    zIndex: layout.zIndex,
                  }}
                >
                  <span className="text-[58px] font-black leading-[0.5] text-[#DDC8F2]" aria-hidden="true">
                    “
                  </span>
                  <p className="flex-1 text-[16px] font-medium leading-[1.62] text-[#3F3350] [text-wrap:pretty] sm:text-[18px]">
                    {item.quote[language]}
                  </p>

                  {/* Yorumun bir-iki kelimelik özeti: uzun metni okumadan da
                      velinin neyi anlattığı görünsün. */}
                  {item.tags.length > 0 && (
                    <ul className="flex flex-wrap items-center gap-2">
                      {item.tags.map((tag, k) => {
                        const tone = TAG_TONES[k % TAG_TONES.length];
                        return (
                          <li
                            key={tag[language]}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-[7px] text-[11px] font-black uppercase tracking-[0.09em] sm:text-[12px]"
                            style={{
                              background: tone.bg,
                              color: tone.ink,
                              border: `2px solid ${tone.line}`,
                              boxShadow: `0 3px 0 ${tone.line}`,
                            }}
                          >
                            <Star className="h-3 w-3 shrink-0" strokeWidth={0} fill="currentColor" />
                            {tag[language]}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>

          {/* lg:contents — geniş ekranda sarmal düzenden çekilir, oklar kartın
              iki yanına konumlanır; dar ekranda kartın altında bir sıra olur. */}
          <div className="mt-6 flex justify-center gap-5 lg:contents">
            <DeckArrow side="left" label={t.testimonials.prev[language]} onClick={() => step(-1)} />
            <DeckArrow side="right" label={t.testimonials.next[language]} onClick={() => step(1)} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Aktif karta olan uzaklığa göre kartın yeri: ortada, yanlarda ya da gizli. */
function deckLayout(distance: number, withSides: boolean) {
  const centered = "translateX(-50%)";
  if (distance === 0) {
    return { transform: `${centered} scale(1) rotate(-1deg)`, opacity: 1, zIndex: 40 };
  }
  if (!withSides) {
    // Dar ekranda yan kartlar görünmez; yalnızca aktif kart okunur.
    return { transform: `${centered} scale(0.9)`, opacity: 0, zIndex: 10 };
  }
  if (distance === 1) {
    return {
      transform: `translateX(calc(-50% + ${SIDE_SHIFT})) scale(0.86) rotate(4deg)`,
      opacity: 0.72,
      zIndex: 30,
    };
  }
  if (distance === 2) {
    return { transform: `${centered} scale(0.78)`, opacity: 0, zIndex: 10 };
  }
  return {
    transform: `translateX(calc(-50% - ${SIDE_SHIFT})) scale(0.86) rotate(-4deg)`,
    opacity: 0.72,
    zIndex: 30,
  };
}

function DeckArrow({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`z-[60] grid h-12 w-12 shrink-0 place-items-center rounded-full text-[#FFF8EF] transition-colors hover:bg-[#B061CC] lg:absolute lg:top-1/2 lg:h-[60px] lg:w-[60px] lg:-translate-y-1/2 ${
        side === "left" ? "lg:-left-[26px]" : "lg:-right-[26px]"
      }`}
      style={{ background: "#A253BE", boxShadow: "0 5px 0 #7E3D96" }}
    >
      <Icon className="h-6 w-6" strokeWidth={3} />
    </button>
  );
}
