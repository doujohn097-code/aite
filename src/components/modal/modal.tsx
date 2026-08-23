import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import cn from 'clsx';
import type { Variants } from 'framer-motion';

type ModalProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  modalAnimation?: Variants;
  modalClassName?: string;
  closePanelOnClick?: boolean;
  closeModal: () => void;
};

const variants: Variants[] = [
  {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  {
    initial: { opacity: 0, scale: 0.94, y: 18 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 420, damping: 30 }
    },
    exit: { opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.16 } }
  }
];

export const [backdrop, modal] = variants;

export function Modal({
  open,
  children,
  className,
  modalAnimation,
  modalClassName,
  closePanelOnClick,
  closeModal
}: ModalProps): JSX.Element {
  const openTimeRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      openTimeRef.current = Date.now();
    }
  }, [open]);

  const handleClose = (): void => {
    // Prevent accidental dismiss from synthetic release events after long-press
    if (Date.now() - openTimeRef.current < 350) return;
    closeModal();
  };

  const isFullHeightPanel = [
    'min-h-screen',
    'h-screen',
    'h-full',
    'h-app',
    '100dvh',
    '100vh'
  ].some((token) => modalClassName?.includes(token));

  const panelClassName = isFullHeightPanel
    ? cn('scroll-native', modalClassName)
    : cn(
        'max-h-[90vh] overflow-y-auto scroll-native',
        modalClassName?.replace(/overflow-hidden/g, 'overflow-y-auto')
      );

  return (
    <AnimatePresence>
      {open && (
        <Dialog
          className='relative z-50'
          open={open}
          onClose={handleClose}
          static
        >
          <motion.div
            className='fixed inset-0 bg-[rgb(var(--main-background)/0.62)] backdrop-blur-[3px]
                       [background-image:radial-gradient(120%_90%_at_50%_0%,rgb(var(--main-accent)/0.12),transparent_60%)]'
            aria-hidden='true'
            {...backdrop}
          />
          <div
            className={cn(
              'fixed inset-0 overflow-y-auto p-4',
              className ?? 'flex items-center justify-center'
            )}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) handleClose();
            }}
          >
            <Dialog.Panel
              className={panelClassName}
              as={motion.div}
              {...(modalAnimation ?? modal)}
              onClick={closePanelOnClick ? handleClose : undefined}
            >
              {children}
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
