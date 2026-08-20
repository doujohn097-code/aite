import type { ReactElement } from 'react';
import cn from 'clsx';

type LogoProps = {
  className?: string;
  size?: number;
};

/**
 * Aite Icon Mark — swaps between the black ink asset (light theme) and the
 * white ink asset (dark theme) since both ship on a transparent canvas.
 */
export function AiteLogo({ className }: LogoProps): ReactElement {
  const classes = className ?? 'h-8 w-8';

  return (
    <>
      <img
        src='/assets/logo-black.png'
        alt='Aite Logo'
        className={cn('select-none object-contain dark:hidden', classes)}
      />
      <img
        src='/assets/logo.png'
        alt=''
        aria-hidden='true'
        className={cn('hidden select-none object-contain dark:block', classes)}
      />
    </>
  );
}

/**
 * Aite Wordmark — same light/dark treatment as the icon mark.
 */
export function AiteWordmark({ className }: LogoProps): ReactElement {
  const classes = className ?? 'h-8 w-auto';

  return (
    <>
      <img
        src='/assets/home-logo-black.png'
        alt='Aite'
        className={cn('select-none object-contain dark:hidden', classes)}
      />
      <img
        src='/assets/home-logo.png'
        alt=''
        aria-hidden='true'
        className={cn('hidden select-none object-contain dark:block', classes)}
      />
    </>
  );
}
