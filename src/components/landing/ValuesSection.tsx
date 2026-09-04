import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import img1 from "@/assets/values-1.jpg";
import img2 from "@/assets/values-2.jpg";
import img3 from "@/assets/values-3.jpg";
import img4 from "@/assets/values-4.jpg";
import img5 from "@/assets/values-5.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/translations";

interface ValueCard {
  id: number;
  image: string;
  quote: Record<Language, string>;
}

const CARDS: ValueCard[] = [
  {
    id: 1,
    image: img1,
    quote: {
      tr: "Öğretmenler! Yeni nesil sizin eseriniz olacaktır.",
      en: "Teachers! The new generation will be your work.",
      fr: "Enseignants ! La nouvelle génération sera votre œuvre.",
      ru: "Учителя! Новое поколение будет вашим творением.",
      es: "¡Maestros! La nueva generación será obra vuestra.",
      de: "Lehrerinnen und Lehrer! Die neue Generation wird euer Werk sein.",
      ar: "أيها المعلمون! الجيل الجديد سيكون من صنع أيديكم.",
    },
  },
  {
    id: 2,
    image: img2,
    quote: {
      tr: "Bugünün küçükleri yarının büyükleridir.",
      en: "Today's little ones are tomorrow's great ones.",
      fr: "Les petits d'aujourd'hui sont les grands de demain.",
      ru: "Сегодняшние малыши — завтрашние великие.",
      es: "Los pequeños de hoy son los grandes de mañana.",
      de: "Die Kleinen von heute sind die Großen von morgen.",
      ar: "صغار اليوم هم كبار الغد.",
    },
  },
  {
    id: 3,
    image: img3,
    quote: {
      tr: "Eğitimdir ki bir milleti ya hür, bağımsız, şanlı, yüksek bir topluluk halinde yaşatır; ya da esaret ve sefalete terk eder.",
      en: "It is education that either enables a nation to live as a free, independent, honoured community, or abandons it to bondage and misery.",
      fr: "C'est l'éducation qui permet à une nation de vivre libre, indépendante et honorée, ou qui l'abandonne à la servitude et à la misère.",
      ru: "Именно образование либо даёт народу жить свободным, независимым, славным и достойным сообществом, либо оставляет его в рабстве и нищете.",
      es: "Es la educación la que permite a una nación vivir como una comunidad libre, independiente y digna, o la abandona a la servidumbre y la miseria.",
      de: "Es ist die Bildung, die eine Nation als freie, unabhängige und geachtete Gemeinschaft leben lässt — oder sie der Knechtschaft und dem Elend überlässt.",
      ar: "إن التعليم هو ما يجعل الأمة تعيش حرة مستقلة عزيزة، أو يتركها للعبودية والبؤس.",
    },
  },
  {
    id: 4,
    image: img4,
    quote: {
      tr: "Çocuklar geleceğimizin güvencesi, yaşama sevincimizdir.",
      en: "Children are the guarantee of our future and the joy of our lives.",
      fr: "Les enfants sont la garantie de notre avenir et la joie de notre vie.",
      ru: "Дети — залог нашего будущего и радость нашей жизни.",
      es: "Los niños son la garantía de nuestro futuro y la alegría de nuestra vida.",
      de: "Kinder sind die Sicherheit unserer Zukunft und die Freude unseres Lebens.",
      ar: "الأطفال ضمانة مستقبلنا وفرحة حياتنا.",
    },
  },
  {
    id: 5,
    image: img5,
    quote: {
      tr: "Öğretmenler, Cumhuriyet sizden fikri hür, vicdanı hür, irfanı hür nesiller ister.",
      en: "Teachers, the Republic asks of you generations free in thought, free in conscience, and free in learning.",
      fr: "Enseignants, la République attend de vous des générations libres de pensée, de conscience et de savoir.",
      ru: "Учителя, Республика ждёт от вас поколений, свободных в мысли, свободных в совести, свободных в знании.",
      es: "Maestros, la República os pide generaciones libres de pensamiento, libres de conciencia y libres de saber.",
      de: "Lehrerinnen und Lehrer, die Republik erwartet von euch Generationen, die frei im Denken, frei im Gewissen und frei im Wissen sind.",
      ar: "أيها المعلمون، تطلب منكم الجمهورية أجيالاً حرة الفكر، حرة الضمير، حرة المعرفة.",
    },
  },
];

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Değerlerimiz — koyu mor blok üzerinde iki polaroid arasında duran alıntı
 * kartı. Kart, Atatürk'ün eğitim üzerine sözleri arasında geziniyor.
 */
export function ValuesSection() {
  const { language, t } = useLanguage();
  const [index, setIndex] = useState(0);

  const go = useCallback((dir: 1 | -1) => setIndex((prev) => mod(prev + dir, CARDS.length)), []);

  const current = CARDS[index];
  const left = CARDS[mod(index - 1, CARDS.length)];
  const right = CARDS[mod(index + 1, CARDS.length)];

  return (
    <section
      id="values"
      className="scroll-section relative overflow-hidden px-5 py-20 sm:px-8 md:py-24"
      style={{ background: "#2E1065" }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{ backgroundImage: "url(/ewd/pat/tile-star-purple.png)", backgroundSize: "300px" }}
        aria-hidden="true"
      />
      {/* Alt kenar: altındaki krem İletişim bölümü buraya doğru kabarır. */}
      <span className="ewd-scallop-b" style={{ ["--scallop" as string]: "#FFF8EF" }} aria-hidden="true" />

      <div className="relative mx-auto flex max-w-[1180px] flex-col items-center gap-11">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#C4A6E8]">
            {t.values.badge[language]}
          </span>
          <h2 className="ewd-h2 text-[#FFF8EF]">{t.values.title[language]}</h2>
        </div>

        <div className="flex w-full items-center justify-center">
          <Polaroid image={left.image} caption={t.values.caption1[language]} rotation={-6} shift={46} />

          <div
            className="relative z-10 flex w-full max-w-[452px] flex-col gap-4 rounded-[24px] px-7 py-9 sm:px-10 sm:pb-8 sm:pt-10"
            style={{
              background: "var(--ewd-cream)",
              transform: "rotate(1deg)",
              boxShadow: "0 34px 54px -22px rgba(0,0,0,0.72)",
            }}
          >
            <span
              className="absolute -left-[22px] -top-4 h-[26px] w-[108px] rotate-[-32deg]"
              style={{ background: "var(--ewd-yellow)" }}
              aria-hidden="true"
            />
            <span
              className="absolute -bottom-3.5 -right-[22px] h-[26px] w-[108px] rotate-[-32deg]"
              style={{ background: "var(--ewd-pink)" }}
              aria-hidden="true"
            />

            <span className="text-[62px] font-black leading-[0.6] text-[#DDC8F2]" aria-hidden="true">
              “
            </span>
            <p className="min-h-[112px] text-[19px] font-bold leading-[1.45] text-[#2E1065] [text-wrap:pretty] sm:text-[22px]">
              {current.quote[language]}
            </p>
            <span className="ewd-script relative z-10 self-end text-[26px] text-[#A253BE] sm:text-[31px]">
              {t.values.quoteAuthor[language]}
            </span>

            <div className="relative z-10 flex items-center justify-between pt-1">
              <div className="flex gap-2" role="tablist" aria-label={t.values.badge[language]}>
                {CARDS.map((card, i) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`${i + 1}`}
                    aria-selected={i === index}
                    role="tab"
                    className="h-2.5 rounded-full transition-all"
                    style={{
                      width: i === index ? 22 : 10,
                      background: i === index ? "var(--ewd-purple)" : "#DDC8F2",
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <NavButton onClick={() => go(-1)} label="‹">
                  <ChevronLeft className="h-4 w-4" />
                </NavButton>
                <NavButton onClick={() => go(1)} label="›">
                  <ChevronRight className="h-4 w-4" />
                </NavButton>
              </div>
            </div>
          </div>

          <Polaroid image={right.image} caption={t.values.caption2[language]} rotation={6} shift={-46} />
        </div>

        <p className="max-w-[620px] text-center text-[16px] font-medium leading-[1.65] text-[#D7C3EF] [text-wrap:pretty] sm:text-[17px]">
          {t.values.lead[language]}
        </p>
      </div>
    </section>
  );
}

function Polaroid({
  image,
  caption,
  rotation,
  shift,
}: {
  image: string;
  caption: string;
  rotation: number;
  shift: number;
}) {
  return (
    <div
      className="relative hidden w-[268px] shrink-0 rounded-[5px] px-3.5 pt-3.5 lg:block"
      style={{
        background: "#FFFDF8",
        transform: `rotate(${rotation}deg) translateX(${shift}px)`,
        boxShadow: "0 22px 34px -18px rgba(0,0,0,0.7)",
      }}
      aria-hidden="true"
    >
      <img src={image} alt="" loading="lazy" className="h-[246px] w-[240px] object-cover grayscale" />
      <div className="ewd-script grid h-[60px] place-items-center text-[23px] text-[#6B5B7B]">{caption}</div>
    </div>
  );
}

function NavButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border-2 text-[#6D28D9] transition-colors hover:bg-[#F4EDFF]"
      style={{ borderColor: "#DDC8F2" }}
    >
      {children}
    </button>
  );
}
