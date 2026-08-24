import {
  isAppLocale,
  localeDir,
  type AppLocale,
  type LocaleDir
} from './index';

let active: AppLocale = 'ar';

export function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'ar';
  try {
    const raw = window.localStorage.getItem('aite:locale');
    return isAppLocale(raw) ? raw : 'ar';
  } catch {
    return 'ar';
  }
}

export function setActiveLocale(locale: AppLocale): void {
  active = locale;
}

export function getActiveLocale(): AppLocale {
  return active;
}

export function getActiveDir(): LocaleDir {
  return localeDir(active);
}

export function applyDocumentLocale(locale: AppLocale): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = locale;
  root.dir = localeDir(locale);
  root.dataset.locale = locale;
}
