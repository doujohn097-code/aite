import cn from 'clsx';
import Link from 'next/link';
import { visibleProfileName, visibleUsername } from '@lib/utils';
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
};

export function UserName({
  tag,
  name,
  verified,
  username,
  className,
  iconClassName,
  disableLink
}: UserNameProps): JSX.Element {
  const CustomTag = tag ? tag : 'p';
  const safeName = visibleProfileName(name);
  const safeUsername = visibleUsername(username);

  const nameContent = (
    <span className='flex flex-col truncate'>
      <span className='flex items-center gap-1'>
        {safeName ? (
          <CustomTag className='truncate'>{safeName}</CustomTag>
        ) : (
          <Skeleton className='h-4 w-24' />
        )}
        {verified && safeName && (
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
    <Link href={`/user/${safeUsername}`}>
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
