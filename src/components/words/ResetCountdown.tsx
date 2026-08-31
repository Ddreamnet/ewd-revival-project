import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { timeUntilReset } from "@/lib/words";

/**
 * Takvim yaprağı sayacı — günün kelimelerinin yenilenmesine kalan süreyi
 * gösterir. Her değer değiştiğinde üst yaprak öne devrilir.
 */
export function ResetCountdown({ className = "" }: { className?: string }) {
  const { language, t } = useLanguage();
  const [remaining, setRemaining] = useState(() => timeUntilReset());

  useEffect(() => {
    // Saniye sınırına hizala: ilk tik hep bir sonraki tam saniyede düşsün.
    let intervalId: number | undefined;
    const alignId = window.setTimeout(() => {
      setRemaining(timeUntilReset());
      intervalId = window.setInterval(() => setRemaining(timeUntilReset()), 1000);
    }, 1000 - (Date.now() % 1000));

    return () => {
      window.clearTimeout(alignId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div
      className={`relative w-full max-w-[330px] rounded-[28px] border-[3px] px-5 pb-5 pt-7 ${className}`}
      style={{ background: "var(--ewd-cream-hi)", borderColor: "var(--ewd-lilac-line)" }}
      role="timer"
      aria-live="off"
    >
      {/* Takvim halkaları */}
      <div className="absolute -top-[9px] left-0 right-0 flex justify-center gap-9">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="h-[18px] w-[10px] rounded-full border-2"
            style={{ background: "var(--ewd-cream)", borderColor: "var(--ewd-lilac-line)" }}
          />
        ))}
      </div>

      <div className="text-center text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#9A87AC]">
        {t.words.countdownTitle[language]}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Flap value={remaining.hours} label={t.words.hours[language]} />
        <Flap value={remaining.minutes} label={t.words.minutes[language]} />
        <Flap value={remaining.seconds} label={t.words.seconds[language]} />
      </div>

      <p className="mt-3.5 text-center text-[12px] font-semibold leading-snug text-[#6B5B7B]">
        {t.words.countdownNote[language]}
      </p>
    </div>
  );
}

function Flap({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, "0");
  const [previous, setPrevious] = useState(text);
  // `tick` yalnızca yaprağı yeniden monte edip animasyonu tekrar oynatmak için.
  const [tick, setTick] = useState(0);
  const lastRef = useRef(text);

  useEffect(() => {
    if (lastRef.current === text) return;
    setPrevious(lastRef.current);
    lastRef.current = text;
    setTick((n) => n + 1);
  }, [text]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="ewd-flap">
        <span className="ewd-flap__num text-[34px] sm:text-[38px]">{text}</span>
        {tick > 0 && (
          <div key={tick} className="ewd-flap__leaf" aria-hidden="true">
            <span className="ewd-flap__num text-[34px] sm:text-[38px]">{previous}</span>
          </div>
        )}
      </div>
      <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9A87AC]">{label}</span>
    </div>
  );
}
