import '@styles/globals.scss';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Capacitor } from '@capacitor/core';
import { AuthContextProvider } from '@lib/context/auth-context';
import { useViewportFix } from '@lib/hooks/useViewportFix';
import { isSafeInternalPath } from '@lib/utils';
import { ThemeContextProvider } from '@lib/context/theme-context';
import { AppHead } from '@components/common/app-head';
import { SplashScreen } from '@components/common/splash-screen';
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
const NATIVE_ROUTE_KEY = 'aite:native-last-route';
const MAX_SAVED_ROUTE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isRestorableRoute(path: string): boolean {
  return (
    isSafeInternalPath(path) &&
    path !== '/' &&
    !path.startsWith('/accounts') &&
    !path.startsWith('/admin')
  );
}

export default function App({
  Component,
  pageProps
}: AppPropsWithLayout): ReactNode {
  const getLayout = Component.getLayout ?? ((page): ReactNode => page);
  const router = useRouter();

  useViewportFix();

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !router.isReady) return;

    const saveRoute = (path: string): void => {
      if (!isRestorableRoute(path)) return;
      try {
        localStorage.setItem(
          NATIVE_ROUTE_KEY,
          JSON.stringify({ path, savedAt: Date.now(), scrollY: window.scrollY })
        );
      } catch {
        // Persistence is best-effort.
      }
    };

    try {
      const raw = localStorage.getItem(NATIVE_ROUTE_KEY);
      const saved = raw
        ? (JSON.parse(raw) as {
            path?: unknown;
            savedAt?: unknown;
            scrollY?: unknown;
          })
        : null;
      if (
        router.asPath === '/' &&
        typeof saved?.path === 'string' &&
        typeof saved.savedAt === 'number' &&
        Date.now() - saved.savedAt <= MAX_SAVED_ROUTE_AGE_MS &&
        isRestorableRoute(saved.path)
      ) {
        void router.replace(saved.path).then(() => {
          if (typeof saved.scrollY === 'number')
            requestAnimationFrame(() =>
              window.scrollTo(0, saved.scrollY as number)
            );
        });
      }
    } catch {
      localStorage.removeItem(NATIVE_ROUTE_KEY);
    }

    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') saveRoute(router.asPath);
    };
    const handlePageHide = (): void => saveRoute(router.asPath);

    window.__aiteNavigate = (path: string): void => {
      if (!isSafeInternalPath(path)) return;
      void router.push(path);
    };

    router.events.on('routeChangeComplete', saveRoute);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      router.events.off('routeChangeComplete', saveRoute);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [router, router.isReady]);

  useEffect(() => {
    const splashKey = 'aite:splash-shown';
    try {
      if (sessionStorage.getItem(splashKey)) {
        setShowSplash(false);
        return;
      }
      sessionStorage.setItem(splashKey, '1');
    } catch {
      // sessionStorage may be unavailable in hardened browsers.
    }
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AppHead />
      <SplashScreen isVisible={showSplash} />
      <AuthContextProvider>
        <ThemeContextProvider>
          <ThemeBackground />
          {getLayout(<Component {...pageProps} />)}
        </ThemeContextProvider>
      </AuthContextProvider>
    </>
  );
}
