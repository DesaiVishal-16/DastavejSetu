'use client';

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

// Import translation files
import { translations as englishTranslations } from '../locales/english';
import { translations as hindiTranslations } from '../locales/hindi';
import { translations as marathiTranslations } from '../locales/marathi';
import { Translations } from '../types/translations';

// Define supported languages - only English, Hindi, and Marathi
export type Language = 'english' | 'hindi' | 'marathi';

// Map of all translations
const allTranslations: Record<Language, Translations> = {
  english: englishTranslations,
  hindi: hindiTranslations,
  marathi: marathiTranslations,
};

// Context type
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

// Create context
const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

// Storage key for persisting language preference
const LANGUAGE_STORAGE_KEY = 'dastavejsetu-language';

// Provider component
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('english');

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem(
      LANGUAGE_STORAGE_KEY,
    ) as Language;
    if (savedLanguage && allTranslations[savedLanguage]) {
      setLanguageState(savedLanguage);
    }
  }, []);

  // Update localStorage when language changes
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: allTranslations[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// Hook to use the language context
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
