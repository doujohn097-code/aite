/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, createContext, useContext } from 'react';
import { flushSync } from 'react-dom';
import { updateUserTheme } from '@lib/firebase/utils';
import { isTheme, themesMeta } from '@lib/types/theme';
import { useAuth } from './auth-context';
import type { ReactNode, ChangeEvent } from 'react';
import type { Theme, Accent } from '@lib/types/theme';

type ThemeOrigin = { x: number; y: number };

type ThemeContext = {
  theme: Theme;
  accent: Accent;
  setTheme: (theme: Theme, origin?: ThemeOrigin) => void;
  setAccent: (accent: Accent) => void;
  changeTheme: ({ target: { value } }: ChangeEvent<HTMLInputElement>) => void;
  changeAccent: ({ target: { value } }: ChangeEvent<HTMLInputElement>) => void;
};

export const ThemeContext = createContext<ThemeContext | null>(null);

type ThemeContextProviderProps = {
  children: ReactNode;
};

function setInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  const savedTheme = localStorage.getItem('theme');

  return isTheme(savedTheme) ? savedTheme : 'dark';
}

function setInitialAccent(): Accent {
  if (typeof window === 'undefined') return 'blue';

  const savedAccent = localStorage.getItem('accent') as Accent | null;

  return savedAccent ?? 'blue';
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
  };
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** موجة ضوئية صغيرة تنطلق من موضع الضغط (احتياطية وجمالية) */
function spawnRipple({ x, y }: ThemeOrigin, radius: number): void {
  const ripple = document.createElement('span');
  ripple.className = 'theme-ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.width = `${radius * 2}px`;
  ripple.style.height = `${radius * 2}px`;
  document.body.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 800);
}

export function ThemeContextProvider({
  children
}: ThemeContextProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(setInitialTheme);
  const [accent, setAccentState] = useState<Accent>(setInitialAccent);

  const { user } = useAuth();
  const { id: userId, theme: userTheme, accent: userAccent } = user ?? {};

  useEffect(() => {
    if (user && userTheme && isTheme(userTheme)) setThemeState(userTheme);
  }, [userId, userTheme]);

  useEffect(() => {
    if (user && userAccent) setAccentState(userAccent);
  }, [userId, userAccent]);

  useEffect(() => {
    const flipTheme = (theme: Theme): NodeJS.Timeout | undefined => {
      const root = document.documentElement;
      const { dark, wallpaper } = themesMeta[theme];

      if (dark) root.classList.add('dark');
      else root.classList.remove('dark');

      if (wallpaper) root.classList.add('theme-wallpaper');
      else root.classList.remove('theme-wallpaper');

      root.dataset.theme = theme;

      root.style.setProperty('--main-background', `var(--${theme}-background)`);

      root.style.setProperty(
        '--main-search-background',
        `var(--${theme}-search-background)`
      );

      root.style.setProperty(
        '--main-sidebar-background',
        `var(--${theme}-sidebar-background)`
      );

      // لون شريط الحالة في الأجهزة المحمولة
      const themeColorMeta = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]'
      );

      if (themeColorMeta) {
        const computed = getComputedStyle(root)
          .getPropertyValue('--main-background')
          .trim();

        const rgb = computed.startsWith('var')
          ? getComputedStyle(root).getPropertyValue(`--${theme}-background`)
          : computed;

        const [r, g, b] = rgb.trim().split(/\s+/);
        if (r && g && b) themeColorMeta.content = `rgb(${r}, ${g}, ${b})`;
      }

      if (user) {
        localStorage.setItem('theme', theme);
        return setTimeout(() => void updateUserTheme(user.id, { theme }), 500);
      }

      localStorage.setItem('theme', theme);

      return undefined;
    };

    const timeoutId = flipTheme(theme);
    return () => clearTimeout(timeoutId);
  }, [userId, theme]);

  useEffect(() => {
    const flipAccent = (accent: Accent): NodeJS.Timeout | undefined => {
      const root = document.documentElement;

      root.style.setProperty('--main-accent', `var(--accent-${accent})`);

      root.style.setProperty(
        '--main-accent-contrast',
        `var(--accent-${accent}-contrast)`
      );

      root.style.setProperty(
        '--main-accent-text',
        `var(--accent-${accent}-text)`
      );

      if (user) {
        localStorage.setItem('accent', accent);
        return setTimeout(() => void updateUserTheme(user.id, { accent }), 500);
      }

      localStorage.setItem('accent', accent);

      return undefined;
    };

    const timeoutId = flipAccent(accent);
    return () => clearTimeout(timeoutId);
  }, [userId, accent]);

  /** تبديل المظهر مع كشف دائري من موضع الضغط */
  const setTheme = (nextTheme: Theme, origin?: ThemeOrigin): void => {
    if (nextTheme === theme) return;

    const suggestedAccent = themesMeta[nextTheme].accent;

    const applyState = (): void => {
      setThemeState(nextTheme);
      if (suggestedAccent) setAccentState(suggestedAccent);
    };

    if (typeof window === 'undefined') {
      applyState();
      return;
    }

    const root = document.documentElement;

    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;

    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    root.style.setProperty('--theme-x', `${x}px`);
    root.style.setProperty('--theme-y', `${y}px`);
    root.style.setProperty('--theme-r', `${Math.ceil(radius)}px`);

    const doc = document as DocumentWithViewTransition;
    const reduceMotion = prefersReducedMotion();

    if (reduceMotion) {
      applyState();
      return;
    }

    root.classList.add('theme-switching');

    const cleanup = (): void => {
      window.setTimeout(() => root.classList.remove('theme-switching'), 950);
    };

    if (!doc.startViewTransition) {
      spawnRipple({ x, y }, radius);
      applyState();
      cleanup();
      return;
    }

    const transition = doc.startViewTransition(() => {
      flushSync(applyState);
    });

    void transition.finished.then(cleanup).catch(cleanup);
  };

  const setAccent = (nextAccent: Accent): void => setAccentState(nextAccent);

  const changeTheme = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => {
    if (isTheme(value)) setTheme(value);
  };

  const changeAccent = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setAccentState(value as Accent);

  const value: ThemeContext = {
    theme,
    accent,
    setTheme,
    setAccent,
    changeTheme,
    changeAccent
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContext {
  const context = useContext(ThemeContext);

  if (!context)
    throw new Error('useTheme must be used within an ThemeContextProvider');

  return context;
}
