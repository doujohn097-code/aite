export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

export const isUsingEmulator =
  isDevelopment && process.env.FIREBASE_USE_EMULATOR === 'true';

export const siteURL =
  (process.env.SITE_URL as string) ||
  (typeof location !== 'undefined' ? location.origin : '');
