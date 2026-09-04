import { useCallback, useEffect, useRef, useState } from "react";
import { configureUtterance, primeVoices, type SpeechKind, type WordLanguage } from "@/lib/words";

/** Sayfada aynı anda tek ses çalsın diye çalan kayıt modül düzeyinde tutulur. */
let currentAudio: HTMLAudioElement | null = null;

function stopAll() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

const hasSpeechSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window;

/**
 * Kelime ve örnek cümle seslendirmesi. Önce sahibin sesinden üretilmiş MP3
 * denenir; dosya yoksa ya da çalınamazsa tarayıcının konuşma motoruna düşülür.
 *
 * `activeKey` hangi butonun konuştuğunu söyler; aynı butona ikinci kez basmak
 * sesi durdurur.
 */
export function useWordVoice(wordLanguage: WordLanguage) {
  const [activeKey, setActiveKey] = useState<SpeechKind | null>(null);
  const activeRef = useRef<SpeechKind | null>(null);
  const aliveRef = useRef(true);

  const setActive = useCallback((key: SpeechKind | null) => {
    activeRef.current = key;
    if (aliveRef.current) setActiveKey(key);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    // Ses listesi tarayıcıya sonradan yüklenir; hoparlöre basılmadan hazırlansın.
    primeVoices();
    return () => {
      aliveRef.current = false;
      // Kart ekrandan kalkarken kendi sesini sustur, başkasınınkine dokunma.
      if (activeRef.current) stopAll();
    };
  }, []);

  const speak = useCallback(
    (key: SpeechKind, text: string, src?: string) => {
      const wasActive = activeRef.current === key;
      stopAll();
      setActive(null);
      if (wasActive) return;

      let fellBack = false;
      const fallback = () => {
        if (fellBack || !hasSpeechSynthesis()) return;
        fellBack = true;
        const utterance = new SpeechSynthesisUtterance(text);
        configureUtterance(utterance, wordLanguage, key);
        utterance.onend = () => {
          if (activeRef.current === key) setActive(null);
        };
        utterance.onerror = () => {
          if (activeRef.current === key) setActive(null);
        };
        window.speechSynthesis.speak(utterance);
        setActive(key);
      };

      if (!src) {
        fallback();
        return;
      }

      const audio = new Audio(src);
      currentAudio = audio;
      const release = () => {
        if (currentAudio === audio) currentAudio = null;
      };
      audio.onended = () => {
        release();
        if (activeRef.current === key) setActive(null);
      };
      // Dosya eksik ya da bozuksa sessiz kalmaktansa tarayıcı sesiyle oku.
      audio.onerror = () => {
        release();
        if (activeRef.current === key) setActive(null);
        fallback();
      };
      audio.play().then(
        () => setActive(key),
        () => {
          release();
          fallback();
        },
      );
    },
    [setActive, wordLanguage],
  );

  return { activeKey, speak, canSpeak: hasSpeechSynthesis() };
}
