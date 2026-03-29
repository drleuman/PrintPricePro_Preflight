// i18n/index.tsx

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { en } from './en';
import { es } from './es';

export type TranslationKeys = keyof typeof en;
export type Locale = 'en' | 'es';

type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  es: es as unknown as Dictionary,
};

// Global singleton for the current locale to allow use in simple functions
let globalLocale: Locale = (localStorage.getItem('ppos_locale') as Locale) || 'en';
let globalSubscribers: (() => void)[] = [];

const notifySubscribers = () => {
    globalSubscribers.forEach(cb => cb());
};

interface LocaleContextType {
  currentLocale: Locale;
  setLocale: (newLocale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLocale, setCurrentLocale] = useState<Locale>(globalLocale);

  const setLocale = (newLocale: Locale) => {
    globalLocale = newLocale;
    localStorage.setItem('ppos_locale', newLocale);
    setCurrentLocale(newLocale);
    notifySubscribers();
  };

  return (
    <LocaleContext.Provider value={{ currentLocale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
};

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

/**
 * Standard t function
 * Usage: {t('key')}
 * Note: Components using this will re-render when the locale changes 
 * if they are inside LocaleProvider and we add a small hook or use the locale from context.
 */
export function t(
  key: TranslationKeys,
  vars?: Record<string, string | number>
): string {
  const dict = dictionaries[globalLocale] || en; 
  let template = (dict as any)[key] as string;

  if (typeof template !== 'string') {
    template = key; 
  }

  if (vars) {
    for (const [vKey, vVal] of Object.entries(vars)) {
      const re = new RegExp(`{{\\s*${vKey}\\s*}}`, 'g');
      template = template.replace(re, String(vVal));
    }
  }

  return template;
}
