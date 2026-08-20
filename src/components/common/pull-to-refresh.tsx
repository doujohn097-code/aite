import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function PullToRefresh(): ReactNode {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const THRESHOLD = 80;
    const onTouchStart = (e: TouchEvent): void => {
      if (window.scrollY === 0 && !refreshing) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };
    const onTouchMove = (e: TouchEvent): void => {
      if (!pulling.current || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        setDistance(Math.min(delta, 140));
        if (delta > 20) e.preventDefault();
      } else {
        pulling.current = false;
        setDistance(0);
      }
    };
    const onTouchEnd = (): void => {
      if (!pulling.current) return;
      pulling.current = false;
      if (distance > THRESHOLD) {
        setRefreshing(true);
        window.location.reload();
      } else {
        setDistance(0);
      }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [distance, refreshing]);

  if (distance === 0 && !refreshing) return null;
  return (
    <div className='pointer-events-none fixed left-1/2 top-3 z-[999] -translate-x-1/2' style={{ transform: `translateX(-50%) translateY(${Math.max(distance - 50, -50)}px)` }}>
      <div className='flex h-10 w-10 items-center justify-center rounded-full bg-[#16181c] shadow-lg ring-1 ring-white/10'>
        <svg viewBox='0 0 24 24' className={`h-5 w-5 text-[#3982f7] ${refreshing ? 'animate-spin' : ''}`} style={refreshing ? {} : { transform: `rotate(${distance * 2}deg)` }} fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'>
          <path d='M21 12a9 9 0 1 1-6.219-8.56' />
        </svg>
      </div>
    </div>
  );
}
