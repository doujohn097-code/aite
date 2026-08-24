import { useEffect, useRef } from 'react';
import cn from 'clsx';
import { useMentionSearch } from '@lib/hooks/useMentionSearch';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import { UserAvatar } from '@components/user/user-avatar';
import { VerifiedBadge } from '@components/ui/verified-badge';
import { Loading } from '@components/ui/loading';

type MentionSuggestProps = {
  query: string | null;
  onSelect: (username: string) => void;
  onClose?: () => void;
  className?: string;
};

export function MentionSuggest({
  query,
  onSelect,
  onClose,
  className
}: MentionSuggestProps): JSX.Element | null {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { users, loading } = useMentionSearch(query, user?.id);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query === null) return;
    const onPointer = (event: MouseEvent): void => {
      if (!boxRef.current?.contains(event.target as Node)) onClose?.();
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [onClose, query]);

  if (query === null) return null;

  return (
    <div
      ref={boxRef}
      role='listbox'
      aria-label={t('compose.mentions')}
      className={cn(
        'absolute inset-x-0 bottom-full z-40 mb-2 overflow-hidden rounded-2xl',
        'border border-light-border/80 bg-main-background/95 shadow-2xl',
        'backdrop-blur-xl dark:border-dark-border/80',
        className
      )}
    >
      <p className='border-b border-light-border/60 px-3 py-2 text-[11px] font-bold text-light-secondary dark:border-dark-border/60 dark:text-dark-secondary'>
        {t('compose.mentions')}
      </p>
      {loading && !users.length ? (
        <div className='flex justify-center py-4'>
          <Loading className='h-6 w-6' />
        </div>
      ) : !users.length ? (
        <p className='px-3 py-3 text-sm text-light-secondary dark:text-dark-secondary'>
          {t('search.none')} @{query}
        </p>
      ) : (
        <ul className='max-h-64 overflow-y-auto py-1'>
          {users.map((item) => (
            <li key={item.id}>
              <button
                type='button'
                role='option'
                aria-selected={false}
                aria-label={t('compose.mentionUser', { username: item.username })}
                className='flex w-full items-center gap-3 px-3 py-2 text-start transition hover:bg-main-accent/10 active:bg-main-accent/15'
                onMouseDown={(event): void => {
                  event.preventDefault();
                  onSelect(item.username);
                }}
              >
                <UserAvatar
                  src={item.photoURL}
                  alt={item.name}
                  username={item.username}
                  size={36}
                  showPresence={false}
                />
                <span className='min-w-0 flex-1'>
                  <span className='flex items-center gap-1 truncate text-sm font-bold text-light-primary dark:text-dark-primary'>
                    {item.name}
                    {item.verified && <VerifiedBadge className='h-3.5 w-3.5' />}
                  </span>
                  <span className='block truncate text-xs text-light-secondary dark:text-dark-secondary'>
                    @{item.username}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
