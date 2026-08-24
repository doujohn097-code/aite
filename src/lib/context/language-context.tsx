import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  LOCALES,
  localeDir,
  translate,
  type AppLocale,
  type LocaleDir,
  type MessageKey,
  type MessageParams
} from '@lib/i18n';
import {
  applyDocumentLocale,
  readStoredLocale,
  setActiveLocale
} from '@lib/i18n/locale-store';
import type { ReactNode } from 'react';

type Translate = (key: MessageKey, params?: MessageParams) => string;

type LanguageContextValue = {
  locale: AppLocale;
  dir: LocaleDir;
  isRtl: boolean;
  locales: AppLocale[];
  t: Translate;
  setLocale: (locale: AppLocale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<AppLocale>(() =>
    typeof window === 'undefined' ? 'ar' : readStoredLocale()
  );

  useEffect(() => {
    setActiveLocale(locale);
    applyDocumentLocale(locale);
    try {
      window.localStorage.setItem('aite:locale', locale);
    } catch {
      /* private mode */
    }
  }, [locale]);

  const setLocale = useCallback((next: AppLocale): void => {
    setLocaleState(next);
  }, []);

  const t = useCallback<Translate>(
    (key, params) => translate(locale, key, params),
    [locale]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      dir: localeDir(locale),
      isRtl: locale === 'ar',
      locales: LOCALES,
      t,
      setLocale
    }),
    [locale, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}

export function useT(): Translate {
  return useLanguage().t;
}
