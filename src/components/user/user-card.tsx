import Link from 'next/link';
import { preventBubbling } from '@lib/utils';
import { StoryAvatar } from '@components/stories/story-avatar';
import { FollowButton } from '@components/ui/follow-button';
import { UserTooltip } from './user-tooltip';
import { UserName } from './user-name';
import { UserFollowing } from './user-following';

import type { User } from '@lib/types/user';

type UserCardProps = User & {
  modal?: boolean;
  follow?: boolean;
};

export function UserCard(user: UserCardProps): JSX.Element {
  const { id, bio, name, modal, follow, username, verified } = user;

  return (
    <Link href={`/user/${username}`}>
      <a
        className='accent-tab hover-animation glass-card grid grid-cols-[auto,1fr] gap-3 px-4
                   py-3 hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
      >
        <UserTooltip avatar {...user} modal={modal}>
          <StoryAvatar user={user} />
        </UserTooltip>
        <div className='flex flex-col gap-1 truncate xs:overflow-visible'>
          <div className='flex items-center justify-between gap-2 truncate xs:overflow-visible'>
            <div className='flex flex-col justify-center truncate xs:overflow-visible xs:whitespace-normal'>
              <UserTooltip {...user} modal={modal}>
                <UserName
                  className='-mb-1'
                  name={name}
                  username={username}
                  verified={verified}
                  disableLink
                />
              </UserTooltip>
              <div className='flex items-center gap-1'>
                {follow && <UserFollowing userTargetId={id} />}
              </div>
            </div>
            <span onClick={preventBubbling()}>
              <FollowButton userTargetId={id} userTargetUsername={username} />
            </span>
          </div>
          {follow && bio && <p className='whitespace-normal'>{bio}</p>}
        </div>
      </a>
    </Link>
  );
}
