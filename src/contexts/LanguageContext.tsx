import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, TranslationKeys } from '@/i18n/translations';
import { useAutoTranslate } from '@/hooks/use-auto-translate';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectBrowserLanguage(): Language {
  const browserLang = navigator.language || (navigator as any).userLanguage;
  const langCode = browserLang?.split('-')[0]?.toLowerCase();
  
  if (langCode === 'en') {
    return 'en';
  }
  
  // Default to French for all other languages
  return 'fr';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // If the user explicitly chose a language in-app, always honour that choice.
    const userSet = localStorage.getItem('preferred_language_user_set') === 'true';
    const stored = localStorage.getItem('preferred_language') as Language;
    if (userSet && (stored === 'fr' || stored === 'en')) {
      return stored;
    }
    // Otherwise always follow the device/phone language (navigator.language
    // reflects the device locale inside the Capacitor WebView).
    return detectBrowserLanguage();
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);
    localStorage.setItem('preferred_language_user_set', 'true');
  };

  useEffect(() => {
    // Update HTML lang attribute
    document.documentElement.lang = language;
  }, [language]);

  // Runtime auto-translation of legacy hardcoded French strings when EN is active.
  useAutoTranslate(language);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Hook for translation with interpolation
export function useTranslation() {
  const { t, language, setLanguage } = useLanguage();
  
  const translate = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = t;
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    if (typeof value !== 'string') {
      return key;
    }
    
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => 
        String(params[paramKey] ?? `{${paramKey}}`)
      );
    }
    
    return value;
  };
  
  return { t: translate, language, setLanguage, translations: t };
}
