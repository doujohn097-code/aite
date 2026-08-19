import Link from 'next/link';
import cn from 'clsx';
import { NextImage } from '@components/ui/next-image';
import { useOnlineStatus } from '@lib/presence-store';

type UserAvatarProps = {
  src?: string | null;
  alt?: string;
  size?: number;
  username?: string;
  className?: string;
};

export function UserAvatar({
  src,
  alt,
  size,
  username,
  className
}: UserAvatarProps): JSX.Element {
  const online = useOnlineStatus(username);

  const pictureSize = size ?? 48;
  const normalizedSrc =
    !src || src === '/assets/default-avatar.jpg'
      ? '/assets/default-avatar.png'
      : src;

  const dotSize = Math.max(10, Math.round(pictureSize / 3));

  const image = (
    <span className='relative inline-flex shrink-0'>
      <NextImage
        useSkeleton
        imgClassName='rounded-full'
        width={pictureSize}
        height={pictureSize}
        src={normalizedSrc}
        alt={alt ?? ''}
        key={normalizedSrc}
      />
      {online && username && (
        <span
          className='absolute -bottom-0.5 -left-0.5 rounded-full bg-emerald-400 ring-2 ring-main-background
                     shadow-[0_0_8px_2px_rgba(52,211,153,0.9)]'
          style={{ width: dotSize, height: dotSize }}
          title='نشط الآن'
        />
      )}
    </span>
  );

  if (!username)
    return (
      <div className={cn('blur-picture flex self-start', className)}>
        {image}
      </div>
    );

  return (
    <Link href={`/user/${username}`}>
      <a
        className={cn('blur-picture flex self-start', className)}
        tabIndex={0}
      >
        {image}
      </a>
    </Link>
  );
}
