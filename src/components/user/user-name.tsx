import cn from 'clsx';
import Link from 'next/link';
import { VerifiedBadge } from '@components/ui/verified-badge';

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

  const nameContent = (
    <span className='flex flex-col truncate'>
      <span className='flex items-center gap-1'>
        <CustomTag className='truncate'>{name}</CustomTag>
        {verified && (
          <VerifiedBadge
            className={cn('shrink-0', iconClassName ?? 'h-4 w-4')}
          />
        )}
      </span>
      {username && (
        <span className='text-sm font-normal text-light-secondary dark:text-dark-secondary'>
          @{username}
        </span>
      )}
    </span>
  );

  return disableLink || !username ? (
    <span
      className={cn('flex items-start gap-1 truncate font-bold', className)}
    >
      {nameContent}
    </span>
  ) : (
    <Link href={`/user/${username}`}>
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
