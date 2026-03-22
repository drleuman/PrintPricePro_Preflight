// i18n/index.ts

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { en } from './en';
import { es } from './es';

export type TranslationKeys = keyof typeof en;
export type Locale = 'en' | 'es';

const dictionaries: Record<Locale, typeof en> = {
  en,
  es,
};

interface LocaleContextType {
  currentLocale: Locale;
  setLocale: (newLocale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLocale, setCurrentLocale] = useState<Locale>('en');

  const setLocale = (newLocale: Locale) => {
    setCurrentLocale(newLocale);
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
 * t('issuesSummary')
 * t('pageLabel', { page: 3 }) -> sustituye {{page}}
 */
export function t(
  key: TranslationKeys,
  vars?: Record<string, string | number>
): string {
  // Para usar en componentes fuera del Provider, o si no hay Provider
  // Se usará el 'en' por defecto, o se puede añadir un mecanismo de detección de idioma del navegador
  const { currentLocale } = useLocale(); // Usamos el hook aquí
  const dict = dictionaries[currentLocale] || en; 
  let template = (dict as any)[key] as string;

  if (typeof template !== 'string') {
    template = key; // fallback visible
  }

  if (vars) {
    for (const [vKey, vVal] of Object.entries(vars)) {
      const re = new RegExp(`{{\\s*${vKey}\\s*}}`, 'g');
      template = template.replace(re, String(vVal));
    }
  }

  return template;
}
