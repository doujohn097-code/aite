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
  // Snapshots can arrive before optional profile fields are populated.
  const safeName = name?.trim() || 'مستخدم';
  const safeUsername = username?.trim();

  const nameContent = (
    <span className='flex flex-col truncate'>
      <span className='flex items-center gap-1'>
        <CustomTag className='truncate'>{safeName}</CustomTag>
        {verified && (
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
