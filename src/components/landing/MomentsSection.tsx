import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Fotoğraf karuselinin kendiliğinden ilerleme aralığı. */
const AUTOPLAY_MS = 5000;

/**
 * "Dersten Kareler" — koyu mor blok, solda ders içi fotoğraflar, sağda ders
 * videoları. Fotoğraf şeridi kendiliğinden ilerler, video şeridi yalnızca elle.
 *
 * Gizlilik: medyadaki yüzler, kamera kutucukları ve isimler dosyanın içine
 * yakılmış yamalarla kapatılmıştır — CSS ile üste konan bir örtü tam ekranda
 * ya da dosya adresine gidilince açığa çıkardı. Videolarda ses yoktur.
 */
export function MomentsSection() {
  const { language, t } = useLanguage();
  const shots = t.moments.shots;
  const clips = t.moments.clips;

  const [shotIndex, setShotIndex] = useState(0);
  const [clipIndex, setClipIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  /* Kullanıcı oka bastığında sayaç baştan başlasın; slayt elinin altından kaymasın. */
  const [autoplayKey, setAutoplayKey] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setShotIndex((i) => (i + 1) % shots.length),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [shots.length, autoplayKey]);

  const goToShot = useCallback((next: number) => {
    setShotIndex(next);
    setAutoplayKey((k) => k + 1);
  }, []);

  /** Görünmeyen videoyu durdur — arkada ses/kare işlemeye devam etmesin. */
  const goToClip = useCallback((next: number) => {
    videoRefs.current.forEach((video, i) => {
      if (video && i !== next) video.pause();
    });
    setClipIndex(next);
  }, []);

  return (
    <section
      id="moments"
      className="scroll-section relative overflow-hidden px-5 py-20 sm:px-8 md:py-24 lg:py-[100px]"
      style={{ background: "#6D28D9" }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: "url(/ewd/pat/tile-star-purple.png)", backgroundSize: "300px" }}
        aria-hidden="true"
      />
      {/* Bu bölümün iki dikişini de komşuları çiziyor: üstte Yetişkin bloğu
          aşağı sarkıyor, altta Veli Yorumları yukarı taşıyor. Her dikiş tek
          elden çizilsin ki üst üste binip bozulmasın. */}

      <div className="relative mx-auto max-w-[1180px]">
        {/* ------------------------------------------------------ başlık bloğu */}
        <div className="flex flex-col items-start gap-6 pb-9 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col items-start gap-2.5">
            <span
              className="ewd-label rounded-full px-5 py-2.5"
              style={{ background: "#FBD34F", color: "#6B4A00" }}
            >
              {t.moments.badge[language]}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="ewd-h2 text-[#FFF8EF]">{t.moments.title[language]}</h2>
              <span className="ewd-script text-[34px] leading-none text-[#FBD34F] sm:text-[44px] lg:text-[54px]">
                {t.moments.titleScript[language]}
              </span>
            </div>
            <p className="ewd-lead mt-1 max-w-[620px] text-[#E4D3F5]">{t.moments.lead[language]}</p>
          </div>

          <div
            className="flex shrink-0 items-center gap-3 rounded-[20px] px-[18px] py-3.5 lg:max-w-[262px]"
            style={{ background: "rgba(255,248,239,0.14)", border: "2px solid rgba(255,248,239,0.3)" }}
          >
            <img src="/uploads/logo.webp" alt="" aria-hidden="true" className="w-[46px] shrink-0" />
            <span className="text-[13px] font-semibold leading-[1.45] text-[#EFE0FF]">
              {t.moments.privacy[language]}
            </span>
          </div>
        </div>

        {/* --------------------------------------------------------- iki şerit */}
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-[76px]">
          <Rail
            label={t.moments.photos[language]}
            dotColor="#EC4899"
            index={shotIndex}
            count={shots.length}
            onGo={goToShot}
            prevLabel={t.moments.prev[language]}
            nextLabel={t.moments.next[language]}
            goToLabel={t.moments.goTo[language]}
          >
            {shots.map((shot) => (
              <Slide key={shot.src} caption={shot.caption[language]}>
                <img
                  src={shot.src}
                  alt={shot.caption[language]}
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
                <Tag>{shot.tag[language]}</Tag>
              </Slide>
            ))}
          </Rail>

          <Rail
            label={t.moments.videos[language]}
            dotColor="#FBD34F"
            index={clipIndex}
            count={clips.length}
            onGo={goToClip}
            prevLabel={t.moments.prev[language]}
            nextLabel={t.moments.next[language]}
            goToLabel={t.moments.goTo[language]}
          >
            {clips.map((clip, i) => (
              <Slide key={clip.src} caption={clip.caption[language]}>
                {/* Poster olmadan, oynatılana kadar siyah bir kutu duruyordu. */}
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={clip.src}
                  poster={clip.poster || undefined}
                  controls
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  className="h-full w-full object-cover"
                />
                <Tag>{t.moments.videoBadge[language]}</Tag>
              </Slide>
            ))}
          </Rail>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- parçalar */

interface RailProps {
  label: string;
  /** Etiketteki yuvarlak nokta — fotoğraf şeridi pembe, video şeridi sarı. */
  dotColor: string;
  index: number;
  count: number;
  onGo: (next: number) => void;
  prevLabel: string;
  nextLabel: string;
  goToLabel: string;
  children: React.ReactNode;
}

/** Etiketi, kayan şeridi, iki oku ve nokta göstergesini taşıyan sarmal. */
function Rail({
  label,
  dotColor,
  index,
  count,
  onGo,
  prevLabel,
  nextLabel,
  goToLabel,
  children,
}: RailProps) {
  const step = (delta: number) => onGo((index + delta + count) % count);

  return (
    <div className="relative">
      <div className="flex items-center gap-3 px-2 pb-3.5">
        <span className="flex items-center gap-2.5 rounded-full bg-[#FFF8EF] py-[9px] pl-3 pr-[18px]">
          <span className="h-[22px] w-[22px] rounded-full" style={{ background: dotColor }} />
          <span className="text-[13px] font-black tracking-[0.12em] text-[#2E1065]">{label}</span>
        </span>
        <span className="flex-1 border-t-2 border-dashed border-[rgba(255,248,239,0.35)]" />
      </div>

      <div className="relative">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-[600ms] [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {children}
          </div>
        </div>

        <Arrow side="left" label={prevLabel} onClick={() => step(-1)} />
        <Arrow side="right" label={nextLabel} onClick={() => step(1)} />
      </div>

      <div className="flex items-center justify-center gap-2.5 pt-5">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onGo(i)}
            aria-label={`${goToLabel} ${i + 1}`}
            aria-current={i === index}
            className="h-2.5 rounded-full transition-[width,background-color] duration-[400ms]"
            style={{
              width: i === index ? 34 : 10,
              background: i === index ? "#FBD34F" : "rgba(255,248,239,0.4)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Bir slayt: üstte medya kutusu, altında açıklama. Açıklama kartın içinde
 * dururken görselin üçte birini kapatıyordu; dışarı alındı. Üzerine gelince
 * gösterme yolu seçilmedi, çünkü dokunmatik ekranda hover yok — orada yazı
 * hiç görünmezdi.
 */
function Slide({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="w-full shrink-0 px-2">
      <div
        className="relative h-[248px] overflow-hidden rounded-[26px] sm:h-[300px] lg:h-[336px]"
        style={{
          background: "#2E1065",
          border: "3px solid #FFF8EF",
          boxShadow: "0 20px 32px -20px rgba(0,0,0,0.7)",
        }}
      >
        {children}
      </div>
      {/* Sabit alt sınır — açıklamalar farklı uzunlukta, slaytlar aynı boyda kalsın. */}
      <p className="mt-3.5 min-h-[44px] text-[14px] font-semibold leading-[1.35] text-[#EFE0FF] [text-wrap:pretty] sm:text-[15px]">
        {caption}
      </p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute left-[18px] top-[18px] rounded-full px-3.5 py-2 text-[11px] font-black tracking-[0.12em]"
      style={{ background: "#FBD34F", color: "#6B4A00" }}
    >
      {children}
    </span>
  );
}

function Arrow({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-[124px] z-30 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-[#6D28D9] transition-colors hover:bg-white sm:top-[150px] lg:top-[168px] lg:h-[60px] lg:w-[60px] ${
        side === "left" ? "-left-2 lg:-left-[18px]" : "-right-2 lg:-right-[18px]"
      }`}
      style={{ background: "#FFF8EF", boxShadow: "0 5px 0 #C9B6F5" }}
    >
      <Icon className="h-6 w-6" strokeWidth={3} />
    </button>
  );
}
