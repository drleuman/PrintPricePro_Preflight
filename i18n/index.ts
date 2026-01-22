// i18n/index.ts

import { en } from './en';

export type TranslationKeys = keyof typeof en;
export type Locale = 'en'; // cuando tengas es/fr/de/lv, amplías aquí

const currentLocale: Locale = 'en';

const dictionaries: Record<Locale, typeof en> = {
  en,
};

/**
 * t('issuesSummary')
 * t('pageLabel', { page: 3 }) -> sustituye {{page}}
 */
export function t(
  key: TranslationKeys,
  vars?: Record<string, string | number>
): string {
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
