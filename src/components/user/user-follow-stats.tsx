/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useLanguage } from '@lib/context/language-context';
import { NumberStats } from '@components/tweet/number-stats';
import type { User } from '@lib/types/user';

type UserFollowStatsProps = Pick<User, 'following' | 'followers'>;
type Stats = [string, string, number, number];

export function UserFollowStats({
  following = [],
  followers = []
}: UserFollowStatsProps): JSX.Element {
  const { t } = useLanguage();
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
    [
      t('profile.following'),
      `${userPath}/following`,
      followingMove,
      currentFollowing
    ],
    [
      t('profile.follower'),
      `${userPath}/followers`,
      followersMove,
      currentFollowers
    ]
  ];

  return (
    <div className='flex items-center gap-2.5 text-light-secondary dark:text-dark-secondary'>
      {allStats.map(([title, link, move, stats], index) => {
        const label =
          index === 1 && stats > 1 ? t('profile.followers') : title;
        return (
          <Link href={link} key={title}>
            <a
              className='group flex items-center gap-1.5 rounded-full border border-light-line-reply/60
                         bg-light-primary/[0.06] px-4 py-1.5 backdrop-blur-md transition
                         hover:bg-light-primary/[0.12] dark:border-white/10 dark:bg-white/[0.06]
                         dark:hover:bg-white/[0.12]'
            >
              <span className='inline-block text-sm font-bold text-light-primary dark:text-dark-primary'>
                <NumberStats move={move} stats={stats} alwaysShowStats />
              </span>
              <span
                className='text-xs font-semibold text-light-secondary transition group-hover:text-light-primary
                               dark:text-dark-secondary dark:group-hover:text-dark-primary'
              >
                {label}
              </span>
            </a>
          </Link>
        );
      })}
    </div>
  );
}
