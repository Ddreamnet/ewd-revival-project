import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Language, LANGUAGES, translations } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'ewd-language';
const SUPPORTED = LANGUAGES.map((l) => l.code);

function isSupported(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED as string[]).includes(value);
}

/** Kayıtlı tercih yoksa tarayıcı diline bak, o da tutmazsa Türkçe'ye düş. */
function detectLanguage(): Language {
  if (typeof window === 'undefined') return 'tr';

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // Özel sekme / kapalı depolama — tarayıcı diline devam et.
  }

  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of candidates) {
    const base = tag?.toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }
  return 'tr';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Depolama kapalıysa dil yalnızca bu oturum boyunca geçerli olur.
    }
    // Ekran okuyucular ve `:lang()` seçicileri için belge dilini de güncelle.
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Helper hook to get translated text
export function useTranslation() {
  const { language, t } = useLanguage();

  const getText = <T extends Record<Language, string>>(obj: T): string => {
    return obj[language];
  };

  return { language, t, getText };
}
