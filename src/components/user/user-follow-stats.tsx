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
    <div className='flex gap-4 text-light-secondary dark:text-dark-secondary'>
      {allStats.map(([title, link, move, stats], index) => {
        const label = index === 1 && stats > 1 ? 'متابعون' : title;
        const statSpan = (
          <span className='inline-block font-bold text-light-primary dark:text-dark-primary'>
            <NumberStats move={move} stats={stats} alwaysShowStats />
          </span>
        );
        const textSpan = <span className='inline-block'>{label}</span>;
        return (
          <Link href={link} key={title}>
            <a
              className='hover-animation flex items-center gap-1 whitespace-nowrap border-b border-b-transparent
                         py-1 outline-none hover:border-b-light-primary focus-visible:border-b-light-primary
                         dark:hover:border-b-dark-primary dark:focus-visible:border-b-dark-primary'
            >
              {index === 0 ? (
                <>
                  {textSpan}
                  <span className='inline-block w-1' />
                  {statSpan}
                </>
              ) : (
                <>
                  {statSpan}
                  <span className='inline-block w-1' />
                  {textSpan}
                </>
              )}
            </a>
          </Link>
        );
      })}
    </div>
  );
}
