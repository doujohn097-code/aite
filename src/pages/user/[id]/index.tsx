import { useState } from 'react';
import Link from 'next/link';
import { doc, query, where, orderBy, documentId } from 'firebase/firestore';
import cn from 'clsx';
import { useLanguage } from '@lib/context/language-context';
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
import { TweetFeedSkeleton } from '@components/ui/skeleton';
import { Tweet } from '@components/tweet/tweet';
import { HeroIcon } from '@components/ui/hero-icon';
import type { IconName } from '@components/ui/hero-icon';
import type { ReactElement, ReactNode } from 'react';

type ProfileTab = 'posts' | 'retweets' | 'reels';

const TAB_DEFS: {
  id: ProfileTab;
  labelKey: 'profile.posts' | 'profile.reposts' | 'profile.reels';
  icon: IconName;
}[] = [
  { id: 'posts', labelKey: 'profile.posts', icon: 'DocumentTextIcon' },
  {
    id: 'retweets',
    labelKey: 'profile.reposts',
    icon: 'ArrowPathRoundedSquareIcon'
  },
  { id: 'reels', labelKey: 'profile.reels', icon: 'PlayIcon' }
];

export default function UserTweets(): JSX.Element {
  const { user } = useUser();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
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
        className='profile-tabs bg-light-sidebar-background/80 dark:bg-dark-sidebar-background/80 sticky top-0 z-10 mx-3 mt-3 flex
                   gap-1 rounded-full border border-main-accent/10
                   p-1.5 backdrop-blur-xl
                   backdrop-saturate-150'
      >
        {TAB_DEFS.map(({ id: tabId, labelKey, icon }) => (
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
            <span className='leading-tight'>{t(labelKey)}</span>
          </button>
        ))}
      </div>

      {isBlocked ? (
        <div className='flex flex-col items-center gap-3 p-12 text-center'>
          <HeroIcon
            className='h-10 w-10 text-light-secondary dark:text-dark-secondary'
            iconName='NoSymbolIcon'
          />
          <p className='font-bold'>{t('profile.blocked')}</p>
          <p className='text-sm text-light-secondary dark:text-dark-secondary'>
            {t('profile.blockedHint')}
          </p>
        </div>
      ) : loading ? (
        <TweetFeedSkeleton count={3} />
      ) : tab === 'posts' ? (
        !ownerOnlyTweets?.length ? (
          <StatsEmpty
            title={t('profile.noPosts', { username: username as string })}
            description={t('profile.noPostsHint')}
          />
        ) : (
          <>
            {pinnedData && (
              <Tweet pinned {...pinnedData} key={`pinned-${pinnedData.id}`} />
            )}
            {ownerOnlyTweets.map((tweet) => (
              <Tweet {...tweet} profile={user} key={tweet.id} />
            ))}
          </>
        )
      ) : tab === 'retweets' ? (
        !filteredPeopleTweets?.length ? (
          <StatsEmpty
            title={t('profile.noReposts')}
            description={t('profile.noRepostsHint')}
          />
        ) : (
          <>
            {filteredPeopleTweets.map((tweet) => (
              <Tweet {...tweet} profile={user} key={tweet.id} />
            ))}
          </>
        )
      ) : !reels?.length ? (
        <StatsEmpty
          title={t('profile.noReels')}
          description={t('profile.noReelsHint')}
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
