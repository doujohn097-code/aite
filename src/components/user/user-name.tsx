import cn from 'clsx';
import Link from 'next/link';
import { useLanguage } from '@lib/context/language-context';
import { profileHref, resolveProfileName, resolveUsername } from '@lib/utils';
import { VerifiedBadge } from '@components/ui/verified-badge';
import { Skeleton } from '@components/ui/skeleton';

type UserNameProps = {
  tag?: keyof JSX.IntrinsicElements;
  name: string;
  verified: boolean;
  username?: string;
  className?: string;
  iconClassName?: string;
  disableLink?: boolean;
  loading?: boolean;
  userId?: string;
};

export function UserName({
  tag,
  name,
  verified,
  username,
  className,
  iconClassName,
  disableLink,
  loading,
  userId
}: UserNameProps): JSX.Element {
  const { t } = useLanguage();
  const CustomTag = tag ? tag : 'p';
  const safeName = resolveProfileName({ name, username }, t('common.user'));
  const safeUsername = resolveUsername({ username });
  const href = profileHref({ id: userId, username: safeUsername });

  const nameContent = (
    <span className='flex flex-col truncate'>
      <span className='flex items-center gap-1'>
        {loading && !name && !username ? (
          <Skeleton className='h-3.5 w-24' />
        ) : (
          <CustomTag className='truncate'>{safeName}</CustomTag>
        )}
        {verified && !!safeName && !loading && (
          <VerifiedBadge
            className={cn('shrink-0', iconClassName ?? 'h-4 w-4')}
          />
        )}
      </span>
      {safeUsername && (
        <span className='text-sm font-normal text-light-secondary dark:text-dark-secondary'>
          @{safeUsername}
        </span>
      )}
    </span>
  );

  return disableLink || !safeUsername ? (
    <span
      className={cn('flex items-start gap-1 truncate font-bold', className)}
    >
      {nameContent}
    </span>
  ) : (
    <Link href={href}>
      <a
        className={cn(
          'flex items-start gap-1 truncate font-bold',
          'custom-underline',
          className
        )}
      >
        {nameContent}
      </a>
    </Link>
  );
}
