import '@styles/globals.scss';

import { useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { useRouter } from 'next/router';
import { Capacitor } from '@capacitor/core';
import { AuthContextProvider } from '@lib/context/auth-context';
import { useViewportFix } from '@lib/hooks/useViewportFix';
import { isSafeInternalPath } from '@lib/utils';
import { LanguageProvider } from '@lib/context/language-context';
import { ThemeContextProvider } from '@lib/context/theme-context';
import { AppHead } from '@components/common/app-head';
import { SplashScreen } from '@components/common/splash-screen';
import { AppUpdatePrompt } from '@components/common/app-update-prompt';
import { GlobalPullToRefresh } from '@components/common/global-pull-to-refresh';
import { ImpersonationBanner } from '@components/common/impersonation-banner';
import { ThemeBackground } from '@components/common/theme-background';
import type { ReactElement, ReactNode } from 'react';
import type { NextPage } from 'next';
import type { AppProps } from 'next/app';

type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

declare global {
  interface Window {
    __aiteNavigate?: (path: string) => void;
  }
}

const SPLASH_DURATION_MS = 3200;
/** مفتاح قديم كان يحفظ آخر صفحة — لم نعد نسترجعها، ونمسح ما تبقّى منها. */
const LEGACY_NATIVE_ROUTE_KEY = 'aite:native-last-route';

export default function App({
  Component,
  pageProps
}: AppPropsWithLayout): ReactNode {
  const getLayout = Component.getLayout ?? ((page): ReactNode => page);
  const router = useRouter();

  useViewportFix();

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setShowSplash(false),
      SPLASH_DURATION_MS
    );
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !router.isReady) return;

    // بدء التشغيل دائماً من الصفحة الرئيسية: لا نسترجع آخر صفحة بعد إغلاق
    // التطبيق. أي مسار محفوظ من إصدار سابق يُمسح حتى لا يعود للظهور.
    try {
      localStorage.removeItem(LEGACY_NATIVE_ROUTE_KEY);
    } catch {
      // التخزين غير متاح — لا شيء لنمسحه.
    }

    window.__aiteNavigate = (path: string): void => {
      if (!isSafeInternalPath(path)) return;
      void router.push(path);
    };
  }, [router, router.isReady]);

  return (
    <MotionConfig reducedMotion='user'>
      <AppHead />
      <SplashScreen
        isVisible={showSplash}
        onSkip={(): void => setShowSplash(false)}
      />
      <LanguageProvider>
        <AuthContextProvider>
          <ThemeContextProvider>
            <ThemeBackground />
            <div className='app-foreground'>
              <AppUpdatePrompt />
              <GlobalPullToRefresh />
              <ImpersonationBanner />
              {getLayout(<Component {...pageProps} />)}
            </div>
          </ThemeContextProvider>
        </AuthContextProvider>
      </LanguageProvider>
    </MotionConfig>
  );
}
