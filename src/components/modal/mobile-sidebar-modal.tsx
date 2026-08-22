import Link from 'next/link';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { Button } from '@components/ui/button';
import { StoryAvatar } from '@components/stories/story-avatar';
import { NextImage } from '@components/ui/next-image';
import { Timestamp } from 'firebase/firestore';
import { UserName } from '@components/user/user-name';
import { MobileSidebarLink } from '@components/sidebar/mobile-sidebar-link';
import { HeroIcon } from '@components/ui/hero-icon';
import { Modal } from './modal';
import { ActionModal } from './action-modal';
import type { NavLink } from '@components/sidebar/sidebar';
import type { User } from '@lib/types/user';

export type MobileNavLink = Omit<NavLink, 'canBeHidden'>;

const coreNavLinks: Readonly<MobileNavLink[]> = [
  {
    href: '/home',
    linkName: 'الرئيسية',
    iconName: 'HomeIcon'
  },
  {
    href: '/reels',
    linkName: 'الريلز',
    iconName: 'FilmIcon'
  },
  {
    href: '/accounts',
    linkName: 'الحسابات',
    iconName: 'UsersIcon'
  },
  {
    href: '/search',
    linkName: 'الأشخاص',
    iconName: 'UserGroupIcon'
  }
];

type Stats = [string, string, number];

type MobileSidebarModalProps = Pick<
  User,
  | 'id'
  | 'name'
  | 'username'
  | 'verified'
  | 'photoURL'
  | 'following'
  | 'followers'
  | 'coverPhotoURL'
> & {
  closeModal: () => void;
};

export function MobileSidebarModal({
  id,
  name,
  username,
  verified,
  photoURL,
  following = [],
  followers = [],
  coverPhotoURL,
  closeModal
}: MobileSidebarModalProps): JSX.Element {
  const { signOut } = useAuth();
  const { open, openModal, closeModal: closeLogOutModal } = useModal();

  const allStats: Readonly<Stats[]> = [
    ['following', 'يتابع', following.length],
    ['followers', 'متابعون', followers.length]
  ];

  const userLink = `/user/${username}`;

  return (
    <>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-6 rounded-3xl shadow-2xl border border-light-border dark:border-dark-border'
        open={open}
        closeModal={closeLogOutModal}
      >
        <ActionModal
          useIcon
          focusOnMainBtn
          title='تسجيل الخروج من Aite؟'
          description='يمكنك تسجيل الدخول مرة أخرى في أي وقت.'
          mainBtnLabel='تسجيل الخروج'
          action={signOut}
          closeModal={closeLogOutModal}
        />
      </Modal>

      <div className='flex h-full flex-col overflow-y-auto bg-main-background'>
        {/* Cover Photo Header */}
        <div className='relative h-28 w-full shrink-0 overflow-hidden bg-gradient-to-tr from-main-accent/30 via-main-accent/15 to-main-accent/5'>
          {coverPhotoURL ? (
            <NextImage
              useSkeleton
              imgClassName='object-cover'
              src={coverPhotoURL}
              alt={name}
              layout='fill'
            />
          ) : (
            <div className='h-full w-full bg-gradient-to-r from-main-accent/25 via-main-accent/15 to-main-accent/5' />
          )}

          {/* Frosted Close Button */}
          <button
            type='button'
            onClick={closeModal}
            aria-label='إغلاق'
            className='absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full
                       bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 active:scale-95'
          >
            <HeroIcon className='h-4 w-4' iconName='XMarkIcon' />
          </button>
        </div>

        {/* User Identity & Avatar Section */}
        <div className='relative px-4 pb-4'>
          {/* Avatar cleanly overlapping bottom edge of cover */}
          <div className='-mt-10 mb-2.5 flex items-end justify-between'>
            <div className='relative z-10 rounded-full bg-main-background p-1 shadow-md'>
              <StoryAvatar
                user={{
                  id,
                  name,
                  username,
                  photoURL,
                  verified,
                  bio: null,
                  theme: null,
                  accent: null,
                  website: null,
                  location: null,
                  following: [],
                  followers: [],
                  createdAt: Timestamp.fromMillis(0),
                  updatedAt: null,
                  totalTweets: 0,
                  totalPhotos: 0,
                  pinnedTweet: null,
                  coverPhotoURL: null
                }}
                size={64}
                onClick={closeModal}
              />
            </div>
          </div>

          <Link href={userLink}>
            <a onClick={closeModal} className='group block'>
              <UserName
                name={name}
                username={username}
                verified={verified}
                className='text-base font-bold transition group-hover:underline'
              />
            </a>
          </Link>

          {/* Stats Bar */}
          <div className='mt-3 flex items-center gap-5 text-sm'>
            {allStats.map(([statId, label, stat]) => (
              <Link href={`${userLink}/${statId}`} key={statId}>
                <a
                  onClick={closeModal}
                  className='flex items-center gap-1.5 transition hover:underline'
                >
                  <span className='font-bold text-light-primary dark:text-dark-primary'>
                    {stat}
                  </span>
                  <span className='text-light-secondary dark:text-dark-secondary'>
                    {label}
                  </span>
                </a>
              </Link>
            ))}
          </div>
        </div>

        <div className='mx-4 border-t border-light-border/70 dark:border-dark-border/70' />

        {/* Always visible account action — navigation alone scrolls on short phones. */}
        <div className='shrink-0 border-y border-light-border/70 bg-main-background px-3 py-2 dark:border-dark-border/70'>
          <Button
            className='flex w-full items-center gap-3 rounded-xl p-3 font-semibold text-accent-red transition hover:bg-accent-red/10 active:bg-accent-red/20'
            onClick={openModal}
          >
            <HeroIcon
              className='h-5 w-5 text-accent-red'
              iconName='ArrowRightOnRectangleIcon'
            />
            <span>تسجيل الخروج</span>
          </Button>
        </div>

        {/* Navigation List */}
        <nav className='flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3'>
          <MobileSidebarLink
            href={userLink}
            iconName='UserIcon'
            linkName='الملف الشخصي'
            onClick={closeModal}
          />
          {coreNavLinks.map((linkData) => (
            <MobileSidebarLink
              {...linkData}
              key={linkData.href}
              onClick={closeModal}
            />
          ))}
        </nav>

        <div className='mx-4 border-t border-light-border/70 dark:border-dark-border/70' />
      </div>
    </>
  );
}
