import Link from 'next/link';
import cn from 'clsx';
import { useLanguage } from '@lib/context/language-context';
import { formatDate } from '@lib/date';
import { ToolTip } from '@components/ui/tooltip';
import type { Tweet } from '@lib/types/tweet';

type TweetDateProps = Pick<Tweet, 'createdAt'> & {
  tweetLink: string;
  viewTweet?: boolean;
  edited?: boolean;
};

export function TweetDate({
  createdAt,
  tweetLink,
  viewTweet,
  edited
}: TweetDateProps): JSX.Element {
  const { t } = useLanguage();
  return (
    <div className={cn('flex gap-1', viewTweet && 'py-4')}>
      {!viewTweet && <i>·</i>}
      <div className='group relative'>
        <Link href={tweetLink}>
          <a
            className={cn(
              'custom-underline peer whitespace-nowrap',
              viewTweet && 'text-light-secondary dark:text-dark-secondary'
            )}
          >
            {formatDate(createdAt, viewTweet ? 'full' : 'tweet')}
          </a>
        </Link>
        <ToolTip
          className='translate-y-1 peer-focus:opacity-100 peer-focus-visible:visible
                     peer-focus-visible:delay-200'
          tip={formatDate(createdAt, 'full')}
        />
      </div>
      {edited && (
        <span className='whitespace-nowrap text-xs text-light-secondary dark:text-dark-secondary'>
          · {t('common.edited')}
        </span>
      )}
    </div>
  );
}
