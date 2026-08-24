import { ar } from './ar';
import { en } from './en';
import { fr } from './fr';
import type { AppLocale, LocaleDir, MessageKey, MessageParams } from './types';

export const LOCALES: AppLocale[] = ['ar', 'en', 'fr'];
export const LOCALE_KEY = 'aite:locale';

const catalogs: Record<AppLocale, Record<MessageKey, string>> = { ar, en, fr };

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'ar' || value === 'en' || value === 'fr';
}

export function localeDir(locale: AppLocale): LocaleDir {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function intlLocale(locale: AppLocale): string {
  return locale === 'ar' ? 'ar' : locale === 'fr' ? 'fr' : 'en';
}

export function translate(
  locale: AppLocale,
  key: MessageKey,
  params?: MessageParams
): string {
  let text = catalogs[locale][key] || catalogs.ar[key] || key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}

export type { AppLocale, LocaleDir, MessageKey, MessageParams };
export { ar, en, fr };
