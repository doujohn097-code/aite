import { Timestamp } from 'firebase/firestore';
import { formatDate } from '@lib/date';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { ExpandableText } from '@components/ui/expandable-text';
import { UserName } from './user-name';
import { UserFollowing } from './user-following';
import { UserFollowStats } from './user-follow-stats';
import type { IconName } from '@components/ui/hero-icon';
import type { User } from '@lib/types/user';

type UserDetailsProps = Pick<
  User,
  | 'id'
  | 'bio'
  | 'name'
  | 'website'
  | 'username'
  | 'location'
  | 'verified'
  | 'createdAt'
  | 'following'
  | 'followers'
>;

type DetailIcon = [string | null, IconName];

export function UserDetails({
  id,
  bio,
  name,
  website,
  username,
  location,
  verified,
  createdAt = Timestamp.now(),
  following,
  followers
}: UserDetailsProps): JSX.Element {
  const detailIcons: Readonly<DetailIcon[]> = [
    [location, 'MapPinIcon'],
    [website, 'LinkIcon'],
    [`انضم في ${formatDate(createdAt, 'joined')}`, 'CalendarDaysIcon']
  ];

  return (
    <>
      <div className='flex flex-col gap-1'>
        <UserName
          className='text-xl'
          name={name}
          verified={verified}
          iconClassName='h-5 w-5'
        />
        <div className='flex flex-wrap items-center gap-2 text-light-secondary dark:text-dark-secondary'>
          <span>@{username}</span>
          <UserFollowing userTargetId={id} />
        </div>
      </div>
      <div className='flex flex-col gap-2.5'>
        {bio && (
          <ExpandableText
            text={bio}
            maxChars={140}
            className='rounded-xl bg-light-sidebar-background/50 p-3 dark:bg-dark-sidebar-background/50'
          />
        )}
        <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-light-secondary dark:text-dark-secondary'>
          {detailIcons.map(
            ([detail, icon], index) =>
              detail && (
                <div className='flex items-center gap-1.5' key={icon}>
                  <i className='flex h-6 w-6 items-center justify-center rounded-full bg-main-accent/10 text-main-accent'>
                    <HeroIcon className='h-3.5 w-3.5' iconName={icon} />
                  </i>
                  {index === 1 ? (
                    <a
                      className='custom-underline text-main-accent'
                      href={`https://${detail}`}
                      target='_blank'
                      rel='noreferrer'
                    >
                      {detail}
                    </a>
                  ) : index === 2 ? (
                    <button className='custom-underline group relative'>
                      {detail}
                      <ToolTip
                        className='translate-y-1'
                        tip={formatDate(createdAt, 'full')}
                      />
                    </button>
                  ) : (
                    <p>{detail}</p>
                  )}
                </div>
              )
          )}
        </div>
      </div>
      <UserFollowStats following={following} followers={followers} />
    </>
  );
}
