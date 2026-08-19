import { useState } from 'react';
import Link from 'next/link';
import { doc, query, where, orderBy, documentId } from 'firebase/firestore';
import { AnimatePresence } from 'framer-motion';
import cn from 'clsx';
import { useUser } from '@lib/context/user-context';
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
import type { ReactElement, ReactNode } from 'react';
import type { Story } from '@lib/types/story';

type ProfileTab = 'posts' | 'retweets' | 'reels';

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'posts', label: 'المنشورات' },
  { id: 'retweets', label: 'المُعاد نشرها' },
  { id: 'reels', label: 'الريلز المعاد نشرها' }
];

export default function UserTweets(): JSX.Element {
  const { user } = useUser();
  const { id, username, pinnedTweet } = user ?? {};

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

  const reelIds = (ownerStats?.reels ?? (ownerStats ? [] : null)) as
    | string[]
    | null;

  const repostedReelsQuery =
    id && reelIds?.length
      ? query(storiesCollection, where(documentId(), 'in', reelIds.slice(0, 30)))
      : null;

  const { data: repostedReels, loading: reelsLoading } = useCollection(
    repostedReelsQuery,
    { allowNull: true, disabled: !id || !reelIds?.length }
  );

  const ownerOnlyTweets = ownerTweets?.filter((tweet) => !tweet.parent) ?? null;

  const filteredPeopleTweets =
    peopleTweets?.filter((tweet) => tweet.createdBy !== id) ?? null;

  const reels =
    repostedReels?.filter((story) => (story as Story).kind === 'reel') ?? null;

  const loading = ownerLoading || peopleLoading || reelsLoading;

  return (
    <section>
      {/* Profile tabs */}
      <div
        className='sticky top-0 z-10 grid grid-cols-3 border-b border-light-border
                   bg-main-background dark:border-dark-border'
      >
        {TABS.map(({ id: tabId, label }) => (
          <button
            key={tabId}
            type='button'
            onClick={(): void => setTab(tabId)}
            className='hover-animation main-tab dark-bg-tab flex justify-center
                       hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
          >
            <p
              className={cn(
                'flex flex-col gap-2 whitespace-nowrap px-2 py-3 text-sm font-bold transition-colors',
                tab === tabId
                  ? 'text-light-primary dark:text-dark-primary'
                  : 'text-light-secondary dark:text-dark-secondary'
              )}
            >
              {label}
              <i
                className={cn(
                  'h-1 rounded-full bg-main-accent transition',
                  tab === tabId ? 'opacity-100' : 'opacity-0'
                )}
              />
            </p>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading className='mt-5' />
      ) : tab === 'posts' ? (
        !ownerOnlyTweets ? (
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
        !filteredPeopleTweets ? (
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
      ) : !reels ? (
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
                  className='relative aspect-[3/4] overflow-hidden bg-light-sidebar-background
                             dark:bg-dark-sidebar-background'
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
