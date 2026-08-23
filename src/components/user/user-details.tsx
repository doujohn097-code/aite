import { Timestamp } from 'firebase/firestore';
import { formatDate } from '@lib/date';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { ExpandableText } from '@components/ui/expandable-text';
import { UserName } from './user-name';
import { GenderBadge } from './gender-badge';
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
  | 'gender'
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
  gender,
  createdAt = Timestamp.now(),
  following,
  followers
}: UserDetailsProps): JSX.Element {
  const detailIcons: Readonly<DetailIcon[]> = [
    [location, 'MapPinIcon'],
    [website, 'LinkIcon']
  ];

  return (
    <>
      <div className='-mt-6 flex flex-col gap-1'>
        <div className='flex items-center justify-between gap-3'>
          <UserName
            className='text-xl'
            name={name}
            verified={verified}
            iconClassName='h-5 w-5'
          />
          <GenderBadge gender={gender} />
        </div>
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
            className='bg-light-sidebar-background/50 dark:bg-dark-sidebar-background/50 rounded-xl p-3'
          />
        )}
        {(location || website) && (
          <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-light-secondary dark:text-dark-secondary'>
            {detailIcons.map(
              ([detail, icon], index) =>
                detail && (
                  <div className='flex items-center gap-1.5' key={icon}>
                    <i className='flex h-6 w-6 items-center justify-center rounded-full bg-main-accent/10 text-main-accent-text'>
                      <HeroIcon className='h-3.5 w-3.5' iconName={icon} />
                    </i>
                    {index === 1 ? (
                      <a
                        className='custom-underline text-main-accent-text'
                        href={`https://${detail}`}
                        target='_blank'
                        rel='noreferrer'
                      >
                        {detail}
                      </a>
                    ) : (
                      <p>{detail}</p>
                    )}
                  </div>
                )
            )}
          </div>
        )}
      </div>
      {/* Joined date + follow stats in one row */}
      <div className='flex flex-wrap items-center gap-3'>
        <button
          className='group relative flex items-center gap-1.5 text-sm
                     text-light-secondary dark:text-dark-secondary'
        >
          <i className='flex h-7 w-7 items-center justify-center rounded-full bg-main-accent/10 text-main-accent-text'>
            <HeroIcon className='h-4 w-4' iconName='CalendarDaysIcon' />
          </i>
          <span className='custom-underline'>
            انضم في {formatDate(createdAt, 'joined')}
          </span>
          <ToolTip
            className='translate-y-1'
            tip={formatDate(createdAt, 'full')}
          />
        </button>
        <UserFollowStats following={following} followers={followers} />
      </div>
    </>
  );
}
