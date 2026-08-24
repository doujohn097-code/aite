import { useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import cn from 'clsx';
import { usePullToRefresh } from '@lib/hooks/usePullToRefresh';
import { PULL_THRESHOLD } from '@lib/pull-to-refresh';
import { HeroIcon } from '@components/ui/hero-icon';

type PullToRefreshProps = {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  scrollRef?: RefObject<HTMLElement | null>;
  disabled?: boolean;
  variant?: 'light' | 'dark';
  className?: string;
};

export function PullToRefresh({
  onRefresh,
  children,
  scrollRef,
  disabled,
  variant = 'light',
  className
}: PullToRefreshProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const { pull, refreshing } = usePullToRefresh({
    onRefresh,
    scrollRef,
    listenRef: hostRef,
    disabled
  });
  const visible = pull > 2 || refreshing;
  const progress = Math.min(1, pull / PULL_THRESHOLD);
  const dark = variant === 'dark';

  return (
    <div ref={hostRef} className={cn('relative', className)}>
      <div
        aria-hidden={!visible}
        className={cn(
          'pointer-events-none absolute inset-x-0 z-40 flex justify-center',
          'transition-opacity duration-150',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          top: `calc(env(safe-area-inset-top, 0px) + ${Math.max(
            8,
            pull * 0.35
          )}px)`
        }}
      >
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-md',
            dark
              ? 'border border-white/15 bg-black/55 text-white'
              : 'border border-light-border bg-main-background/90 text-main-accent-text dark:border-dark-border'
          )}
          style={{
            transform: `scale(${0.72 + progress * 0.28}) rotate(${
              refreshing ? 0 : progress * 220
            }deg)`
          }}
        >
          <HeroIcon
            className={cn('h-5 w-5', refreshing && 'animate-spin')}
            iconName='ArrowPathIcon'
          />
        </div>
      </div>
      {children}
    </div>
  );
}
