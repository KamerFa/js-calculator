import { createContext, useContext, useState, useEffect } from 'react';
import bs from './locales/bs.json';
import en from './locales/en.json';

const translations = { bs, en };
const STORAGE_KEY = 'dash_language';
const DEFAULT_LANGUAGE = 'bs'; // Bosnian as default

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && translations[stored] ? stored : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    if (typeof value !== 'string') return key;

    // Replace placeholders like {count}, {name}, etc.
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : match;
    });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return context;
}

export const availableLanguages = [
  { code: 'bs', name: 'Bosanski', flag: '🇧🇦' },
  { code: 'en', name: 'English', flag: '🇬🇧' }
];
