import cn from 'clsx';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { AiteWordmark } from '@components/ui/aite-logo';
import type { ReactNode } from 'react';
import type { IconName } from '@components/ui/hero-icon';

type HomeHeaderProps = {
  tip?: string;
  title?: string;
  logo?: string;
  children?: ReactNode;
  iconName?: IconName;
  className?: string;
  disableSticky?: boolean;
  useActionButton?: boolean;
  useMobileSidebar?: boolean;
  action?: () => void;
};

export function MainHeader({
  tip,
  title,
  logo,
  children,
  iconName,
  className,
  disableSticky,
  useActionButton,
  useMobileSidebar,
  action
}: HomeHeaderProps): JSX.Element {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex min-h-[53px] items-center justify-between rounded-b-3xl border-b border-light-border/60 bg-main-background/80 px-4 py-2 backdrop-blur-xl backdrop-saturate-150 dark:border-dark-border/60',
        'pt-[max(0.5rem,env(safe-area-inset-top))]',
        disableSticky && 'relative',
        className
      )}
    >
      {/* Right / Start slot */}
      <div className='flex min-w-[40px] items-center justify-start'>
        {useActionButton && (
          <Button
            className='dark-bg-tab group relative p-2 hover:bg-light-primary/10 active:bg-light-primary/20 
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            onClick={action}
          >
            <HeroIcon
              className='h-5 w-5'
              iconName={iconName ?? 'ArrowLeftIcon'}
            />
            <ToolTip tip={tip ?? 'رجوع'} />
          </Button>
        )}
        {useMobileSidebar && (
          <div className='xs:hidden'>
            <MobileSidebar />
          </div>
        )}
      </div>

      {/* Center slot (Logo or Title) */}
      <div className='flex flex-1 items-center justify-center px-2'>
        {logo ? (
          <button
            onClick={() => window.location.replace('/home')}
            title='الرئيسية + تحديث'
            aria-label='الرئيسية'
            className='cursor-pointer'
          >
            <AiteWordmark className='h-8 max-h-9 w-auto max-w-[140px]' />
          </button>
        ) : title ? (
          <h2 className='truncate text-xl font-bold' key={title}>
            {title}
          </h2>
        ) : null}
      </div>

      {/* Left / End slot */}
      <div className='flex min-w-[40px] items-center justify-end'>
        {children}
      </div>
    </header>
  );
}
