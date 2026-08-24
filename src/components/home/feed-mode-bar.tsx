import cn from 'clsx';
import { FEED_MODE_LABELS, type FeedMode } from '@lib/feed-rank';
import { HeroIcon } from '@components/ui/hero-icon';

const MODES: { id: FeedMode; icon: string; hint: string }[] = [
  {
    id: 'pulse',
    icon: 'SparklesIcon',
    hint: 'مزيج من المتابَعين والجدة والتفاعل'
  },
  {
    id: 'following',
    icon: 'UserGroupIcon',
    hint: 'من تتابعهم فقط'
  },
  {
    id: 'latest',
    icon: 'ClockIcon',
    hint: 'الأحدث أولاً'
  },
  {
    id: 'hot',
    icon: 'FireIcon',
    hint: 'الأكثر تفاعلاً الآن'
  }
];

type FeedModeBarProps = {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
  variant?: 'light' | 'dark';
};

export function FeedModeBar({
  mode,
  onChange,
  variant = 'light'
}: FeedModeBarProps): JSX.Element {
  const dark = variant === 'dark';

  return (
    <div
      className={cn(
        'flex gap-1.5 overflow-x-auto px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        dark ? 'bg-transparent' : 'border-b border-light-border/70 dark:border-dark-border/70'
      )}
      role='tablist'
      aria-label='ترتيب المحتوى'
    >
      {MODES.map((item) => {
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type='button'
            role='tab'
            aria-selected={active}
            title={item.hint}
            onClick={(): void => onChange(item.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95',
              dark
                ? active
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
                : active
                ? 'bg-main-accent text-main-accent-contrast shadow-sm'
                : 'bg-light-primary/5 text-light-secondary hover:bg-light-primary/10 dark:bg-dark-primary/10 dark:text-dark-secondary'
            )}
          >
            <HeroIcon className='h-3.5 w-3.5' iconName={item.icon} />
            {FEED_MODE_LABELS[item.id]}
          </button>
        );
      })}
    </div>
  );
}
