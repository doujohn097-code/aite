import Link from 'next/link';
import cn from 'clsx';
import { NextImage } from '@components/ui/next-image';

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
  const pictureSize = size ?? 48;
  const normalizedSrc =
    !src || src === '/assets/default-avatar.jpg'
      ? '/assets/default-avatar.png'
      : src;

  const image = (
    <NextImage
      useSkeleton
      imgClassName='rounded-full'
      width={pictureSize}
      height={pictureSize}
      src={normalizedSrc}
      alt={alt ?? ''}
      key={normalizedSrc}
    />
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
