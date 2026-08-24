export type AppLocale = 'ar' | 'en' | 'fr';

export type LocaleDir = 'rtl' | 'ltr';

export type MessageParams = Record<string, string | number>;

export type MessageKey = keyof typeof import('./ar').ar;
