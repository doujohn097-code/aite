/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { NumberStats } from '@components/tweet/number-stats';
import type { User } from '@lib/types/user';

type UserFollowStatsProps = Pick<User, 'following' | 'followers'>;
type Stats = [string, string, number, number];

export function UserFollowStats({
  following = [],
  followers = []
}: UserFollowStatsProps): JSX.Element {
  const totalFollowing = following.length;
  const totalFollowers = followers.length;

  const [{ currentFollowers, currentFollowing }, setCurrentStats] = useState({
    currentFollowing: totalFollowing,
    currentFollowers: totalFollowers
  });

  useEffect(() => {
    setCurrentStats({
      currentFollowing: totalFollowing,
      currentFollowers: totalFollowers
    });
  }, [totalFollowing, totalFollowers]);

  const followingMove = useMemo(
    () => (totalFollowing > currentFollowing ? -25 : 25),
    [totalFollowing]
  );

  const followersMove = useMemo(
    () => (totalFollowers > currentFollowers ? -25 : 25),
    [totalFollowers]
  );

  const {
    query: { id }
  } = useRouter();

  const userPath = `/user/${id as string}`;

  const allStats: Readonly<Stats[]> = [
    ['يتابع', `${userPath}/following`, followingMove, currentFollowing],
    ['متابع', `${userPath}/followers`, followersMove, currentFollowers]
  ];

  return (
    <div className='flex items-center gap-3 text-light-secondary dark:text-dark-secondary'>
      {allStats.map(([title, link, move, stats], index) => {
        const label = index === 1 && stats > 1 ? 'متابعون' : title;
        const statSpan = (
          <span className='inline-block text-lg font-bold leading-none text-light-primary dark:text-dark-primary'>
            <NumberStats move={move} stats={stats} alwaysShowStats />
          </span>
        );
        return (
          <Link href={link} key={title}>
            <a
              className='group flex flex-col items-center gap-0.5 rounded-xl bg-light-sidebar-background/50 px-4 py-1.5
                         transition hover:bg-light-primary/10 dark:bg-dark-sidebar-background/50
                         dark:hover:bg-dark-primary/10'
            >
              {statSpan}
              <span className='text-xs font-semibold text-light-secondary transition group-hover:text-light-primary
                               dark:text-dark-secondary dark:group-hover:text-dark-primary'>
                {label}
              </span>
            </a>
          </Link>
        );
      })}
    </div>
  );
}
