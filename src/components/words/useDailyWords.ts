import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CARDS_PER_DAY,
  drawRandomWords,
  getDailyWords,
  nextResetAt,
  type WordEntry,
} from "@/lib/words";
import type { WordControlsValue } from "./WordControls";

const DEFAULT_CONTROLS: WordControlsValue = { wordLanguage: "en", level: "all", category: "all" };

/**
 * Kart listesini yönetir: varsayılan olarak günün kelimeleri, kullanıcı
 * "rastgele çek" derse filtreye uyan rastgele bir üçlü. Yenilenme saati
 * geldiğinde günün kelimeleri kendiliğinden değişir.
 */
export function useDailyWords(initial: Partial<WordControlsValue> = {}) {
  const [controls, setControls] = useState<WordControlsValue>({ ...DEFAULT_CONTROLS, ...initial });
  const [randomEntries, setRandomEntries] = useState<WordEntry[] | null>(null);
  // Yenilenme anında günün kelimelerini yeniden hesaplamak için bir sayaç.
  const [cycle, setCycle] = useState(0);

  const daily = useMemo(() => {
    // `cycle`, 20.00 geldiğinde listeyi yeniden hesaplatmak için bir bağımlılık.
    void cycle;
    return getDailyWords(controls.wordLanguage);
  }, [controls.wordLanguage, cycle]);

  // Bir sonraki 20.00'de listeyi tazele — sayfa açık kalsa bile güncellensin.
  useEffect(() => {
    const msUntilReset = nextResetAt().getTime() - Date.now();
    const timer = window.setTimeout(
      () => {
        setCycle((n) => n + 1);
        setRandomEntries(null);
      },
      Math.max(1000, msUntilReset + 500),
    );
    return () => window.clearTimeout(timer);
  }, [cycle]);

  const draw = useCallback((next: WordControlsValue) => {
    setRandomEntries(drawRandomWords(next.wordLanguage, { level: next.level, category: next.category }, CARDS_PER_DAY));
  }, []);

  /**
   * Seviye ya da konu seçilir seçilmez kartlar değişsin — kullanıcının ayrıca
   * "rastgele çek"e basması gerekmesin. Filtreler "tümü"ne dönerse günün
   * kelimelerine geri düşülür.
   */
  const updateControls = useCallback(
    (next: WordControlsValue) => {
      setControls(next);
      const filtered = next.level !== "all" || next.category !== "all";
      if (filtered) draw(next);
      else setRandomEntries(null);
    },
    [draw],
  );

  const shuffle = useCallback(() => draw(controls), [controls, draw]);

  // "Günün kelimelerine dön": filtreleri de sıfırla ki şerit ile kartlar
  // birbirini yalanlamasın.
  const reset = useCallback(() => {
    setControls((prev) => ({ ...prev, level: "all", category: "all" }));
    setRandomEntries(null);
  }, []);

  return {
    controls,
    setControls: updateControls,
    entries: randomEntries ?? daily,
    isRandom: randomEntries !== null,
    isEmpty: randomEntries !== null && randomEntries.length === 0,
    shuffle,
    reset,
  };
}
