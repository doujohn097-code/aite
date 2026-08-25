import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { preventBubbling } from '@lib/utils';
import type { ReactNode } from 'react';

type OverflowMenuProps = {
  align?: 'start' | 'end';
  buttonClassName?: string;
  button: ReactNode;
  children: (close: () => void) => ReactNode;
  'aria-label'?: string;
};

const MENU_WIDTH = 240;

export function OverflowMenu({
  align = 'end',
  buttonClassName,
  button,
  children,
  'aria-label': ariaLabel
}: OverflowMenuProps): JSX.Element {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: MENU_WIDTH });

  const close = (): void => setOpen(false);

  const updatePosition = (): void => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panel = panelRef.current;
    const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
    const height = panel?.offsetHeight ?? 220;
    const rtl = document.documentElement.dir === 'rtl';
    const preferEnd = align === 'end';
    let left = preferEnd
      ? rtl
        ? rect.left
        : rect.right - width
      : rtl
      ? rect.right - width
      : rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - width - 8);
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - 8)
      top = Math.max(8, rect.top - height - 8);
    setPos({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent): void => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('touchstart', onPointer, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('touchstart', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup='menu'
        className={buttonClassName}
        onClick={preventBubbling(() => setOpen((value) => !value))}
        onMouseDown={preventBubbling()}
      >
        {button}
      </button>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                role='menu'
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: 'spring', duration: 0.32, bounce: 0.18 }}
                style={{ top: pos.top, left: pos.left, width: pos.width }}
                className='menu-container fixed z-[80] overflow-hidden rounded-2xl
                           bg-main-background text-light-primary dark:text-dark-primary'
                onClick={preventBubbling()}
                onMouseDown={preventBubbling()}
              >
                {children(close)}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
