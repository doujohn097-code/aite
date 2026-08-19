import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import cn from 'clsx';
import { preventBubbling } from '@lib/utils';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { NumberStats } from './number-stats';
import type { IconName } from '@components/ui/hero-icon';

type TweetOption = {
  tip: string;
  move?: number;
  stats?: number;
  iconName: IconName;
  disabled?: boolean;
  className: string;
  viewTweet?: boolean;
  iconClassName: string;
  solid?: boolean;
  /** Springy pop animation whenever `solid` flips. */
  pop?: boolean;
  onClick?: (...args: unknown[]) => unknown;
};

export function TweetOption({
  tip,
  move,
  stats,
  disabled,
  iconName,
  className,
  viewTweet,
  iconClassName,
  solid,
  pop,
  onClick
}: TweetOption): JSX.Element {
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
  }, []);

  const icon = (
    <HeroIcon
      className={viewTweet ? 'h-6 w-6' : 'h-5 w-5'}
      iconName={iconName}
      solid={solid}
    />
  );

  return (
    <Button
      className={cn(
        `group w-full bg-transparent p-0 transition-none
         disabled:cursor-not-allowed inner:transition inner:duration-200`,
        disabled && 'cursor-not-allowed',
        className
      )}
      innerClassName='gap-1.5'
      onClick={preventBubbling(onClick)}
      disabled={disabled}
    >
      <i
        className={cn(
          'relative rounded-full p-2 not-italic group-focus-visible:ring-2',
          iconClassName
        )}
      >
        {pop ? (
          <motion.span
            key={String(solid)}
            initial={mounted.current ? { scale: 0.3, rotate: -12 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 700, damping: 15 }}
            className='flex'
          >
            {icon}
          </motion.span>
        ) : (
          icon
        )}
        <ToolTip tip={tip} />
      </i>
      <NumberStats move={move as number} stats={stats as number} />
    </Button>
  );
}
