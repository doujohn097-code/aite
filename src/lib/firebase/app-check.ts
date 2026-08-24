import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
  type AppCheck
} from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

let appCheck: AppCheck | null = null;

export function maybeInitAppCheck(app: FirebaseApp): void {
  if (typeof window === 'undefined' || appCheck) return;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey) return;
  // Do not block first paint / auth / splash if reCAPTCHA is slow or blocked.
  window.setTimeout(() => {
    if (appCheck) return;
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
    } catch {
      appCheck = null;
    }
  }, 1800);
}

export async function appCheckHeaders(): Promise<Record<string, string>> {
  if (!appCheck) return {};
  try {
    const { token } = await getToken(appCheck, false);
    return token ? { 'X-Firebase-AppCheck': token } : {};
  } catch {
    return {};
  }
}
