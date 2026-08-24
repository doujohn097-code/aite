import { where, orderBy } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { useWindow } from '@lib/context/window-context';
import { useInfiniteScroll } from '@lib/hooks/useInfiniteScroll';
import { useRankedFeed } from '@lib/hooks/useRankedFeed';
import { getTimestampMillis } from '@lib/date';
import { tweetsCollection } from '@lib/firebase/collections';
import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { Input } from '@components/input/input';
import { NotificationsButton } from '@components/home/notifications-button';
import { MainHeader } from '@components/home/main-header';
import { StoriesBar } from '@components/stories/stories-bar';
import { Tweet } from '@components/tweet/tweet';
import { TweetFeedSkeleton } from '@components/ui/skeleton';
import { Error } from '@components/ui/error';
import { HeroIcon } from '@components/ui/hero-icon';
import type { ReactElement, ReactNode } from 'react';
import type { RankableItem } from '@lib/feed-rank';
import type { TweetWithUser } from '@lib/types/tweet';

function mapTweet(tweet: TweetWithUser): RankableItem {
  return {
    id: tweet.id,
    authorId: tweet.createdBy,
    createdAtMs: getTimestampMillis(tweet.createdAt),
    likes: tweet.userLikes?.length ?? 0,
    replies: tweet.userReplies ?? 0,
    reposts: tweet.userRetweets?.length ?? 0,
    hasMedia: Boolean(tweet.images?.length ?? tweet.audio)
  };
}

export default function Home(): JSX.Element {
  const { isMobile } = useWindow();
  const { user } = useAuth();

  const { data, loading, LoadMore } = useInfiniteScroll(
    tweetsCollection,
    [where('parent', '==', null), orderBy('createdAt', 'desc')],
    { includeUser: true, allowNull: true, preserve: true },
    { initialSize: 40, stepSize: 25 }
  );

  const ranked = useRankedFeed(data, {
    mapItem: mapTweet,
    viewerId: user?.id ?? null,
    following: user?.following ?? [],
    kind: 'post'
  });

  return (
    <MainContainer>
      <SEO title='الرئيسية / Aite' />
      <MainHeader
        useMobileSidebar
        logo='/assets/home-logo.png'
        className='flex items-center justify-between'
      >
        <NotificationsButton />
      </MainHeader>
      {/* Stories bar - force rebuild */}
      <StoriesBar />
      {!isMobile && <Input />}
      <section className='mt-0.5 xs:mt-0'>
        {loading && !data ? (
          <TweetFeedSkeleton />
        ) : !data ? (
          <Error message='حدث خطأ ما. حاول إعادة التحميل.' />
        ) : !ranked.length ? (
          <div className='flex flex-col items-center gap-3 px-6 py-16 text-center'>
            <HeroIcon
              className='h-10 w-10 text-light-secondary dark:text-dark-secondary'
              iconName='SparklesIcon'
            />
            <p className='font-bold'>لا توجد منشورات بعد</p>
            <p className='text-sm text-light-secondary dark:text-dark-secondary'>
              كن أول من ينشر.
            </p>
          </div>
        ) : (
          <>
            {ranked.map((tweet) => (
              <Tweet {...tweet} key={tweet.id} />
            ))}
            <LoadMore />
          </>
        )}
      </section>
    </MainContainer>
  );
}

Home.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);
