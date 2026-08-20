import { useRef, useEffect, useState } from 'react';
import cn from 'clsx';
import { Dialog } from '@headlessui/react';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';

type ActionModalProps = {
  title: string;
  useIcon?: boolean;
  description: string;
  mainBtnLabel: string;
  focusOnMainBtn?: boolean;
  mainBtnClassName?: string;
  secondaryBtnLabel?: string;
  secondaryBtnClassName?: string;
  action: () => void | Promise<void>;
  closeModal: () => void;
  loading?: boolean;
};

export function ActionModal({
  title,
  useIcon,
  description,
  mainBtnLabel,
  focusOnMainBtn,
  mainBtnClassName,
  secondaryBtnLabel,
  secondaryBtnClassName,
  action,
  closeModal,
  loading: loadingProp
}: ActionModalProps): JSX.Element {
  const mainBtn = useRef<HTMLButtonElement>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loadingProp ?? internalLoading;

  useEffect(() => {
    if (!focusOnMainBtn) return;
    const timeoutId = setTimeout(() => mainBtn.current?.focus(), 50);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = (): void => {
    const result = action();
    if (result && typeof result === 'object' && 'then' in result) {
      setInternalLoading(true);
      void (result as Promise<unknown>).finally(() =>
        setInternalLoading(false)
      );
    }
  };

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-4'>
        {useIcon && (
          <i className='mx-auto'>
            <CustomIcon className='h-10 w-10' iconName='AiteIcon' />
          </i>
        )}
        <div className='flex flex-col gap-2'>
          <Dialog.Title className='text-xl font-bold'>{title}</Dialog.Title>
          <Dialog.Description className='text-light-secondary dark:text-dark-secondary'>
            {description}
          </Dialog.Description>
        </div>
      </div>
      <div className='flex flex-col gap-3 inner:py-2 inner:font-bold'>
        <Button
          className={cn(
            'text-white',
            mainBtnClassName ??
              `bg-light-primary hover:bg-light-primary/90 focus-visible:bg-light-primary/90 active:bg-light-primary/80
               dark:bg-light-border dark:text-light-primary dark:hover:bg-light-border/90
               dark:focus-visible:bg-light-border/90 dark:active:bg-light-border/75`
          )}
          ref={mainBtn}
          onClick={handleAction}
          loading={isLoading}
        >
          {mainBtnLabel}
        </Button>
        <Button
          className={cn(
            'border border-light-line-reply dark:border-light-secondary dark:text-light-border',
            secondaryBtnClassName ??
              `hover:bg-light-primary/10 focus-visible:bg-light-primary/10 active:bg-light-primary/20
               dark:hover:bg-light-border/10 dark:focus-visible:bg-light-border/10 dark:active:bg-light-border/20`
          )}
          onClick={closeModal}
          disabled={isLoading}
        >
          {secondaryBtnLabel ?? 'إلغاء'}
        </Button>
      </div>
    </div>
  );
}
