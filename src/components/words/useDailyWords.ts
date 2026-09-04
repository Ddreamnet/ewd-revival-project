import { useCallback, useEffect, useMemo, useState } from "react";
import { cycleStartFor, getDailyWords, MAX_HISTORY_DAYS, nextResetAt } from "@/lib/words";
import type { WordControlsValue } from "./WordControls";

const DEFAULT_CONTROLS: WordControlsValue = { wordLanguage: "en", level: "all" };

/**
 * Kart listesini yönetir. Kartlar her zaman günün kelimeleridir; seçim
 * tarihe bağlı olduğu için her cihazda aynıdır. Oklarla geçmiş günler de
 * gezilebilir (`dayOffset`: 0 bugün, -1 dün) ve seviye çipleri seçimi o
 * seviyeyle sınırlar.
 */
export function useDailyWords(initial: Partial<WordControlsValue> = {}) {
  const [controls, setControls] = useState<WordControlsValue>({ ...DEFAULT_CONTROLS, ...initial });
  const [dayOffset, setDayOffset] = useState(0);
  // Yenilenme anında günün kelimelerini yeniden hesaplamak için bir sayaç.
  const [cycle, setCycle] = useState(0);

  const dayDate = useMemo(() => {
    // `cycle`, 09.00 geldiğinde tarihi yeniden hesaplatmak için bir bağımlılık.
    void cycle;
    return cycleStartFor(dayOffset);
  }, [dayOffset, cycle]);

  const entries = useMemo(
    () => getDailyWords(controls.wordLanguage, dayDate, controls.level),
    [controls.wordLanguage, controls.level, dayDate],
  );

  // Bir sonraki 09.00'da listeyi tazele — sayfa açık kalsa bile güncellensin.
  useEffect(() => {
    const msUntilReset = nextResetAt().getTime() - Date.now();
    const timer = window.setTimeout(() => setCycle((n) => n + 1), Math.max(1000, msUntilReset + 500));
    return () => window.clearTimeout(timer);
  }, [cycle]);

  const canGoPrev = dayOffset > -MAX_HISTORY_DAYS;
  const canGoNext = dayOffset < 0;
  const goPrevDay = useCallback(() => setDayOffset((d) => Math.max(-MAX_HISTORY_DAYS, d - 1)), []);
  const goNextDay = useCallback(() => setDayOffset((d) => Math.min(0, d + 1)), []);

  return {
    controls,
    setControls,
    entries,
    isEmpty: entries.length === 0,
    dayOffset,
    dayDate,
    canGoPrev,
    canGoNext,
    goPrevDay,
    goNextDay,
  };
}
