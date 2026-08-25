import Link from 'next/link';
import cn from 'clsx';
import { NextImage } from '@components/ui/next-image';
import { useLanguage } from '@lib/context/language-context';
import { useOnlineStatus } from '@lib/presence-store';

type UserAvatarProps = {
  src?: string | null;
  alt?: string;
  size?: number;
  username?: string;
  className?: string;
  /** Set false to hide the green presence dot (e.g. inside chat bubbles). */
  showPresence?: boolean;
  /** لا تغلف الصورة برابط الملف الشخصي — ضروري داخل أزرار الحسابات المحفوظة. */
  disableLink?: boolean;
};

export function UserAvatar({
  src,
  alt,
  size,
  username,
  className,
  showPresence = true,
  disableLink
}: UserAvatarProps): JSX.Element {
  const { t } = useLanguage();
  const online = useOnlineStatus(showPresence ? username : undefined);

  const pictureSize = size ?? 48;
  const normalizedSrc =
    !src || src === '/assets/default-avatar.jpg'
      ? '/assets/default-avatar.png'
      : src;

  const dotSize = Math.max(8, Math.round(pictureSize / 4));

  const image = (
    <span className='relative inline-flex shrink-0'>
      <NextImage
        useSkeleton
        className='overflow-hidden rounded-full'
        imgClassName='rounded-full object-cover'
        width={pictureSize}
        height={pictureSize}
        src={normalizedSrc}
        alt={alt ?? ''}
        key={normalizedSrc}
      />
      {online && username && (
        <span
          className='absolute bottom-0 left-0 z-10 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.9)] ring-2
                     ring-main-background'
          style={{ width: dotSize, height: dotSize }}
          title={t('common.online')}
        />
      )}
    </span>
  );

  if (!username || disableLink)
    return (
      <div className={cn('blur-picture flex self-start', className)}>
        {image}
      </div>
    );

  return (
    <Link href={`/user/${username}`}>
      <a className={cn('blur-picture flex self-start', className)} tabIndex={0}>
        {image}
      </a>
    </Link>
  );
}
