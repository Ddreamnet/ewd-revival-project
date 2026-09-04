import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Language, LANGUAGES, isRtl } from '@/lib/translations';
import { applySiteData, type Translations } from '@/lib/siteContent';
import { useSiteData } from '@/hooks/useSiteData';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Seçili dil sağdan sola mı yazılıyor? */
  rtl: boolean;
  /** Kod içindeki sözlük + admin panelinden yapılan değişiklikler. */
  t: Translations;
  /** Admin bir şey kaydettikten sonra siteyi tazelemek için. */
  refreshSiteContent: () => void;
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
  const { data: siteData, refetch: refreshSiteContent } = useSiteData();

  /* Veri gelene kadar koddaki sözlük geçerli — landing ilk karede boyanır. */
  const t = useMemo(() => applySiteData(siteData), [siteData]);

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
    // Arapça sağdan sola akar; yön belgeye yazılır ki bütün düzen (kaydırma,
    // hizalama, `ms-*`/`me-*` boşlukları) tek yerden dönsün.
    const dir = isRtl(language) ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.dataset.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, rtl: isRtl(language), t, refreshSiteContent }}>
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
  const { language, t, rtl } = useLanguage();

  const getText = <T extends Record<Language, string>>(obj: T): string => {
    return obj[language];
  };

  return { language, t, rtl, getText };
}
