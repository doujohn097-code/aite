import { forwardRef, useState } from 'react';
import cn from 'clsx';
import { Loading } from './loading';
import type { ComponentPropsWithRef } from 'react';

type ButtonProps = ComponentPropsWithRef<'button'> & {
  loading?: boolean;
  innerClassName?: string;
};

// eslint-disable-next-line react/display-name
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, innerClassName, loading: loadingProp, disabled, children, onClick, ...rest }, ref) => {
    const [internalLoading, setInternalLoading] = useState(false);
    const isLoading = loadingProp ?? internalLoading;
    const isDisabled = isLoading || !!disabled;

    const handleClick = (
      e: React.MouseEvent<HTMLButtonElement>
    ): void => {
      if (!onClick) return;
      const result = onClick(e) as unknown;
      if (result && typeof result === 'object' && 'then' in result) {
        setInternalLoading(true);
        void (result as Promise<unknown>).finally(() =>
          setInternalLoading(false)
        );
      }
    };

    return (
      <button
        className={cn(
          'custom-button main-tab',
          isLoading && 'relative disabled:cursor-wait',
          className
        )}
        type={rest.type ?? 'button'}
        disabled={isDisabled}
        ref={ref}
        onClick={handleClick}
        {...rest}
      >
        {isLoading && (
          <Loading
            iconClassName='h-5 w-5'
            className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
          />
        )}
        <span
          className={cn(
            'flex items-center justify-center',
            isLoading && 'invisible',
            innerClassName
          )}
        >
          {children}
        </span>
      </button>
    );
  }
);
