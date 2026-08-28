import Link from 'next/link';
import cn from 'clsx';
import { formatNumber } from '@lib/date';
import { useLanguage } from '@lib/context/language-context';
import {
  profileHref,
  resolveProfileName,
  resolveUsername,
  visibleProfileName
} from '@lib/utils';
import { HeroIcon } from '@components/ui/hero-icon';
import { VerifiedBadge } from '@components/ui/verified-badge';
import type { SharedPostRef } from '@lib/types/message';
import type { User } from '@lib/types/user';

export type SharedProfileCardData = {
  id: string;
  name: string | null;
  username: string | null;
  photoURL: string | null;
  coverURL: string | null;
  bio: string | null;
  verified?: boolean | null;
  followers?: number | null;
};

export function sharedProfileFromUser(user: User): SharedProfileCardData {
  return {
    id: user.id,
    name: (visibleProfileName(user.name) ?? resolveProfileName(user)) || null,
    username: resolveUsername(user),
    photoURL: user.photoURL || null,
    coverURL: user.coverPhotoURL || null,
    bio: user.bio?.trim() || null,
    verified: !!user.verified,
    followers: user.followers?.length ?? 0
  };
}

export function sharedProfileFromRef(
  shared: SharedPostRef
): SharedProfileCardData {
  return {
    id: shared.id,
    name: shared.authorName,
    username: shared.authorUsername,
    photoURL: shared.authorPhoto,
    coverURL: shared.thumbnail,
    bio: shared.text,
    verified: shared.verified,
    followers: shared.followers
  };
}

export function SharedProfileCardSkeleton(): JSX.Element {
  return (
    <div className='w-[min(280px,calc(100vw-104px))] overflow-hidden rounded-2xl border border-light-border bg-main-background dark:border-dark-border'>
      <div className='h-20 animate-pulse bg-light-secondary/15 dark:bg-dark-secondary/20' />
      <div className='-mt-7 px-3 pb-3'>
        <div className='h-14 w-14 animate-pulse rounded-full bg-light-secondary/20 ring-4 ring-main-background dark:bg-dark-secondary/30' />
        <div className='mt-2 h-3.5 w-28 animate-pulse rounded-full bg-light-secondary/20 dark:bg-dark-secondary/30' />
        <div className='mt-1.5 h-2.5 w-20 animate-pulse rounded-full bg-light-secondary/15 dark:bg-dark-secondary/20' />
      </div>
    </div>
  );
}

type SharedProfileCardProps = {
  profile: SharedProfileCardData;
};

export function SharedProfileCard({
  profile
}: SharedProfileCardProps): JSX.Element {
  const { t } = useLanguage();
  const username = resolveUsername(profile);
  const name = resolveProfileName(profile);
  const href = profileHref(profile, username ? `/user/${username}` : '/home');
  const photo = profile.photoURL || '/assets/default-avatar.png';
  const followers =
    typeof profile.followers === 'number' ? profile.followers : null;

  return (
    <Link href={href}>
      <a
        className='block w-[min(280px,calc(100vw-104px))] overflow-hidden rounded-2xl border border-main-accent/20 bg-main-background/95 text-light-primary shadow-lg shadow-black/10 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-xl dark:text-dark-primary'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='relative h-20 overflow-hidden bg-gradient-to-br from-main-accent/35 via-main-accent/10 to-main-search-background'>
          {profile.coverURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className='h-full w-full object-cover'
              src={profile.coverURL}
              alt=''
              draggable={false}
              onError={(event): void => {
                // غلاف تالف: أخفِه ليبقى التدرج الزجاجي الأنيق ظاهرًا
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span className='absolute inset-0 bg-gradient-to-t from-black/25 to-transparent' />
          <span className='absolute top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur [inset-inline-start:0.75rem]'>
            {t('messages.profile')}
          </span>
        </div>
        <div className='relative px-3 pb-3 pt-1'>
          <div className='-mt-8 mb-2'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className='h-14 w-14 rounded-full object-cover ring-4 ring-main-background'
              src={photo}
              alt={name}
              draggable={false}
              onError={(event): void => {
                const target = event.currentTarget;
                if (!target.src.endsWith('/assets/default-avatar.png'))
                  target.src = '/assets/default-avatar.png';
              }}
            />
          </div>
          <div className='flex min-w-0 items-center gap-1'>
            <p className='user-text truncate text-[15px] font-black leading-tight'>
              {name}
            </p>
            {profile.verified && <VerifiedBadge className='h-4 w-4 shrink-0' />}
          </div>
          {username && (
            <p className='truncate text-[12px] text-light-secondary dark:text-dark-secondary'>
              <span dir='ltr'>@{username}</span>
            </p>
          )}
          {profile.bio && (
            <p className='user-text mt-1.5 line-clamp-2 text-[13px] leading-snug opacity-80'>
              {profile.bio}
            </p>
          )}
          <div className='mt-2.5 flex items-center justify-between gap-2'>
            {followers !== null ? (
              <span className='text-[11px] font-semibold text-light-secondary dark:text-dark-secondary'>
                {formatNumber(followers)} {t('profile.followers')}
              </span>
            ) : (
              <span />
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full bg-main-accent/15 px-2.5 py-1 text-[11px] font-bold text-main-accent-text'
              )}
            >
              <HeroIcon className='h-3.5 w-3.5' iconName='UserIcon' />
              {t('messages.viewProfile')}
            </span>
          </div>
        </div>
      </a>
    </Link>
  );
}
