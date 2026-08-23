import { useState } from 'react';
import Link from 'next/link';
import { doc, query, where, orderBy, documentId } from 'firebase/firestore';
import { AnimatePresence } from 'framer-motion';
import cn from 'clsx';
import { useUser } from '@lib/context/user-context';
import { useAuth } from '@lib/context/auth-context';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
import {
  tweetsCollection,
  storiesCollection,
  userStatsCollection
} from '@lib/firebase/collections';
import { UserLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { UserDataLayout } from '@components/layout/user-data-layout';
import { UserHomeLayout } from '@components/layout/user-home-layout';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Loading } from '@components/ui/loading';
import { Tweet } from '@components/tweet/tweet';
import { HeroIcon } from '@components/ui/hero-icon';
import type { IconName } from '@components/ui/hero-icon';
import type { ReactElement, ReactNode } from 'react';

type ProfileTab = 'posts' | 'retweets' | 'reels';

const TABS: { id: ProfileTab; label: string; icon: IconName }[] = [
  { id: 'posts', label: 'المنشورات', icon: 'DocumentTextIcon' },
  {
    id: 'retweets',
    label: 'المُعاد نشرها',
    icon: 'ArrowPathRoundedSquareIcon'
  },
  { id: 'reels', label: 'الريلز المعاد نشرها', icon: 'PlayIcon' }
];

export default function UserTweets(): JSX.Element {
  const { user } = useUser();
  const { user: authUser } = useAuth();
  const { id, username, pinnedTweet } = user ?? {};
  const isBlocked = !!id && authUser?.blockedUsers?.includes(id);

  const [tab, setTab] = useState<ProfileTab>('posts');

  const pinnedRef = pinnedTweet ? doc(tweetsCollection, pinnedTweet) : null;

  const { data: pinnedData } = useDocument(pinnedRef, {
    disabled: !pinnedTweet,
    allowNull: true,
    includeUser: true
  });

  const ownerTweetsQuery = id
    ? query(
        tweetsCollection,
        where('createdBy', '==', id),
        orderBy('createdAt', 'desc')
      )
    : null;

  const { data: ownerTweets, loading: ownerLoading } = useCollection(
    ownerTweetsQuery,
    { includeUser: true, allowNull: true, disabled: !id }
  );

  const peopleTweetsQuery = id
    ? query(tweetsCollection, where('userRetweets', 'array-contains', id))
    : null;

  const { data: peopleTweets, loading: peopleLoading } = useCollection(
    peopleTweetsQuery,
    { includeUser: true, allowNull: true, disabled: !id }
  );

  // Reel retweets live on the owner's stats doc (story doc updates are
  // blocked by Firestore rules for that field)
  const ownerStatsRef = id ? doc(userStatsCollection(id), 'stats') : null;
  const { data: ownerStats } = useDocument(ownerStatsRef, {
    allowNull: true,
    disabled: !id
  });

  const reelIds = ownerStats?.reels ?? (ownerStats ? [] : null);

  const repostedReelsQuery =
    id && reelIds?.length
      ? query(
          storiesCollection,
          where(documentId(), 'in', reelIds.slice(0, 30))
        )
      : null;

  const { data: repostedReels, loading: reelsLoading } = useCollection(
    repostedReelsQuery,
    { allowNull: true, disabled: !id || !reelIds?.length }
  );

  const ownerOnlyTweets = ownerTweets?.filter((tweet) => !tweet.parent) ?? null;

  const filteredPeopleTweets =
    peopleTweets?.filter((tweet) => tweet.createdBy !== id) ?? null;

  const reels = repostedReels?.filter((story) => story.kind === 'reel') ?? null;

  const loading = ownerLoading || peopleLoading || reelsLoading;

  return (
    <section>
      {/* Profile tabs */}
      <div
        className='bg-light-sidebar-background/60 dark:bg-dark-sidebar-background/60 sticky top-0 z-10 mx-3 mt-3 flex gap-1
                   rounded-full p-1.5'
      >
        {TABS.map(({ id: tabId, label, icon }) => (
          <button
            key={tabId}
            type='button'
            onClick={(): void => setTab(tabId)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold transition-all',
              tab === tabId
                ? 'bg-main-accent text-main-accent-contrast shadow-sm'
                : 'text-light-secondary hover:bg-light-line-reply/50 dark:text-dark-secondary dark:hover:bg-dark-line-reply/50'
            )}
          >
            <HeroIcon className='h-4 w-4' iconName={icon} />
            <span className='leading-tight'>{label}</span>
          </button>
        ))}
      </div>

      {isBlocked ? (
        <div className='flex flex-col items-center gap-3 p-12 text-center'>
          <HeroIcon
            className='h-10 w-10 text-light-secondary dark:text-dark-secondary'
            iconName='NoSymbolIcon'
          />
          <p className='font-bold'>لقد حظرت هذا الحساب</p>
          <p className='text-sm text-light-secondary dark:text-dark-secondary'>
            لن تظهر منشوراته أو محتواه في خلاصتك.
          </p>
        </div>
      ) : loading ? (
        <Loading className='mt-5' />
      ) : tab === 'posts' ? (
        !ownerOnlyTweets?.length ? (
          <StatsEmpty
            title={`@${username as string} لم ينشر`}
            description='عندما ينشر، ستظهر منشوراته هنا.'
          />
        ) : (
          <AnimatePresence mode='popLayout'>
            {pinnedData && (
              <Tweet pinned {...pinnedData} key={`pinned-${pinnedData.id}`} />
            )}
            {ownerOnlyTweets.map((tweet) => (
              <Tweet {...tweet} profile={user} key={tweet.id} />
            ))}
          </AnimatePresence>
        )
      ) : tab === 'retweets' ? (
        !filteredPeopleTweets?.length ? (
          <StatsEmpty
            title='لا توجد منشورات معاد نشرها'
            description='عندما يعيد النشر، ستظهر هنا.'
          />
        ) : (
          <AnimatePresence mode='popLayout'>
            {filteredPeopleTweets.map((tweet) => (
              <Tweet {...tweet} profile={user} key={tweet.id} />
            ))}
          </AnimatePresence>
        )
      ) : !reels?.length ? (
        <StatsEmpty
          title='لا توجد ريلز معاد نشرها'
          description='عندما يعيد نشر ريلاً، ستظهر هنا.'
        />
      ) : (
        <div className='grid grid-cols-3 gap-0.5 py-0.5'>
          {reels.map((reel) => {
            const media = reel.images?.[0];
            const isVideo = media?.src?.match(/\.(mp4|webm|mov)($|\?)/i);
            return (
              <Link href='/reels' key={reel.id}>
                <a
                  className='bg-light-sidebar-background dark:bg-dark-sidebar-background relative aspect-[3/4]
                             overflow-hidden'
                >
                  {media &&
                    (isVideo ? (
                      <video
                        src={media.src}
                        muted
                        playsInline
                        className='h-full w-full object-cover'
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={media.src}
                        alt={media.alt ?? 'reel'}
                        className='h-full w-full object-cover'
                      />
                    ))}
                </a>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

UserTweets.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <UserLayout>
        <UserDataLayout>
          <UserHomeLayout>{page}</UserHomeLayout>
        </UserDataLayout>
      </UserLayout>
    </MainLayout>
  </ProtectedLayout>
);
