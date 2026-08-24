import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  PULL_THRESHOLD,
  isAtScrollSurface,
  isMostlyVertical,
  resistPull,
  shouldArmPull
} from '@lib/pull-to-refresh';

type Options = {
  onRefresh: () => void | Promise<void>;
  scrollRef?: RefObject<HTMLElement | null>;
  listenRef?: RefObject<HTMLElement | null>;
  disabled?: boolean;
  threshold?: number;
};

export function usePullToRefresh({
  onRefresh,
  scrollRef,
  listenRef,
  disabled,
  threshold = PULL_THRESHOLD
}: Options): { pull: number; refreshing: boolean } {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const armed = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const disabledRef = useRef(disabled);

  onRefreshRef.current = onRefresh;
  disabledRef.current = disabled;
  refreshingRef.current = refreshing;

  const reset = useCallback((): void => {
    armed.current = false;
    pullRef.current = 0;
    setPull(0);
  }, []);

  useEffect(() => {
    const node = listenRef?.current ?? scrollRef?.current ?? document;
    const root = scrollRef?.current ?? null;

    const onStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches[0];
      const atSurface = isAtScrollSurface(event.target, root);
      armed.current = shouldArmPull({
        disabled: disabledRef.current,
        refreshing: refreshingRef.current,
        atSurface
      });
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      pullRef.current = 0;
      if (!armed.current) setPull(0);
    };

    const onMove = (event: TouchEvent): void => {
      if (!armed.current || refreshingRef.current) return;
      if (!isAtScrollSurface(event.target, root)) {
        reset();
        return;
      }
      const touch = event.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;
      if (!isMostlyVertical(dx, dy)) {
        if (Math.abs(dx) > 18 && Math.abs(dx) > dy) reset();
        return;
      }
      const next = resistPull(dy);
      pullRef.current = next;
      setPull(next);
      if (next > 8 && event.cancelable) event.preventDefault();
    };

    const onEnd = (): void => {
      if (!armed.current) return;
      const distance = pullRef.current;
      armed.current = false;
      if (distance < threshold || refreshingRef.current) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      setRefreshing(true);
      refreshingRef.current = true;
      setPull(threshold);
      void Promise.resolve(onRefreshRef.current())
        .catch(() => undefined)
        .finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
        });
    };

    const listen = node as EventTarget;
    listen.addEventListener('touchstart', onStart as EventListener, {
      passive: true
    });
    listen.addEventListener('touchmove', onMove as EventListener, {
      passive: false
    });
    listen.addEventListener('touchend', onEnd as EventListener, {
      passive: true
    });
    listen.addEventListener('touchcancel', onEnd as EventListener, {
      passive: true
    });
    return () => {
      listen.removeEventListener('touchstart', onStart as EventListener);
      listen.removeEventListener('touchmove', onMove as EventListener);
      listen.removeEventListener('touchend', onEnd as EventListener);
      listen.removeEventListener('touchcancel', onEnd as EventListener);
    };
  }, [listenRef, reset, scrollRef, threshold]);

  return { pull, refreshing };
}
