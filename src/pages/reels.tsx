import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { query, where } from 'firebase/firestore';
import { AnimatePresence } from 'framer-motion';
import { storiesCollection, usersCollection } from '@lib/firebase/collections';
import { useAuth } from '@lib/context/auth-context';
import { useInfiniteScroll } from '@lib/hooks/useInfiniteScroll';
import { useCollection } from '@lib/hooks/useCollection';
import { useRankedFeed } from '@lib/hooks/useRankedFeed';
import { getTimestampMillis } from '@lib/date';
import type { RankableItem } from '@lib/feed-rank';
import type { Story } from '@lib/types/story';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { Loading } from '@components/ui/loading';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ReelCard } from '@components/reels/reel-card';
import { CreateReelModal } from '@components/reels/create-reel-modal';
import { PullToRefresh } from '@components/common/pull-to-refresh';
import type { ReactElement, ReactNode } from 'react';
import type { User } from '@lib/types/user';

function fallbackUser(userId: string): User {
  return {
    id: userId,
    name: 'مستخدم',
    username: 'unknown',
    photoURL: '/assets/default-avatar.png',
    verified: false,
    bio: null,
    theme: null,
    accent: null,
    website: null,
    location: null,
    following: [],
    followers: [],
    createdAt: undefined as unknown as User['createdAt'],
    updatedAt: null,
    totalTweets: 0,
    totalPhotos: 0,
    pinnedTweet: null,
    coverPhotoURL: null,
    storyColor: null,
    lastStoryAt: null,
    storyViews: null
  };
}

function mapReel(reel: Story): RankableItem {
  return {
    id: reel.id,
    authorId: reel.userId,
    createdAtMs: getTimestampMillis(reel.createdAt),
    likes: reel.likes?.length ?? 0,
    replies: 0,
    reposts: reel.userRetweets?.length ?? 0,
    views: reel.views?.length ?? 0,
    hasMedia: true
  };
}

export default function Reels(): JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const deepLinkId =
    typeof router.query.video === 'string' ? router.query.video : null;
  const [activeIndex, setActiveIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [deepLinkReady, setDeepLinkReady] = useState(!deepLinkId);
  const containerRef = useRef<HTMLDivElement>(null);

  const reelsConstraints = useMemo(() => [], []);

  const {
    data: rawReels,
    loading: reelsLoading,
    LoadMore,
    refresh
  } = useInfiniteScroll(
    storiesCollection,
    reelsConstraints,
    { allowNull: true },
    { initialSize: 50, stepSize: 25 }
  );

  const visibleReels = useMemo(() => {
    if (!rawReels) return [];
    const nowMs = Date.now();
    return rawReels.filter((s) => {
      const isReelOrVideo =
        s.kind === 'reel' ||
        s.images?.some((img) => img.type?.startsWith('video/')) ||
        s.images?.some(
          (img) =>
            img.src?.includes('.mp4') ||
            img.src?.includes('.mov') ||
            img.src?.includes('.webm')
        );

      if (!isReelOrVideo) return false;
      if (!s.expiresAt) return true;
      const exp = getTimestampMillis(s.expiresAt) || Infinity;
      return exp > nowMs;
    });
  }, [rawReels]);

  const reels = useRankedFeed(visibleReels, {
    mapItem: mapReel,
    viewerId: user?.id ?? null,
    following: user?.following ?? [],
    kind: 'reel'
  });

  // resolve owners for visible reels
  const ownerIds = useMemo(
    () => Array.from(new Set(reels.map((r) => r.userId))),
    [reels]
  );

  const ownersQuery = useMemo(
    () =>
      ownerIds.length
        ? query(usersCollection, where('__name__', 'in', ownerIds.slice(0, 10)))
        : null,
    [ownerIds]
  );
  const { data: owners } = useCollection(ownersQuery, { allowNull: true });

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    owners?.forEach((u) => map.set(u.id, u));
    return map;
  }, [owners]);

  useEffect(() => {
    if (activeIndex > reels.length - 1 && reels.length > 0) {
      setActiveIndex(0);
    }
  }, [reels.length, activeIndex]);

  useEffect(() => {
    setDeepLinkReady(!deepLinkId);
  }, [deepLinkId]);

  // Deep links must open on the requested reel without visibly traversing
  // every reel above it. Keep the feed hidden for one frame, jump instantly,
  // then reveal the target card.
  useEffect(() => {
    if (!deepLinkId) {
      setDeepLinkReady(true);
      return;
    }
    if (!reels.length) return;
    const index = reels.findIndex((reel) => reel.id === deepLinkId);
    if (index < 0) {
      setDeepLinkReady(true);
      return;
    }
    setActiveIndex(index);
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container) {
        const previous = container.style.scrollBehavior;
        container.style.scrollBehavior = 'auto';
        container.scrollTop = index * container.clientHeight;
        container.style.scrollBehavior = previous;
      }
      setDeepLinkReady(true);
    });
  }, [deepLinkId, reels]);

  // Keyboard navigation up / down
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (createOpen) return;
      const container = containerRef.current;
      if (!container) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIdx = Math.min(activeIndex + 1, reels.length - 1);
        container.scrollTo({
          top: nextIdx * container.clientHeight,
          behavior: 'smooth'
        });
        setActiveIndex(nextIdx);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIdx = Math.max(activeIndex - 1, 0);
        container.scrollTo({
          top: prevIdx * container.clientHeight,
          behavior: 'smooth'
        });
        setActiveIndex(prevIdx);
      }
    },
    [activeIndex, reels.length, createOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget;
    if (!el.clientHeight) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== activeIndex && idx >= 0 && idx < reels.length) {
      setActiveIndex(idx);
    }
  };

  const handleRefresh = async (): Promise<void> => {
    const container = containerRef.current;
    if (container) {
      container.style.scrollBehavior = 'auto';
      container.scrollTop = 0;
    }
    setActiveIndex(0);
    await refresh();
  };

  return (
    <MainLayout>
      <SEO title='الريلز / Aite' />
      <div className='relative flex h-app-nav w-full items-center justify-center overflow-hidden bg-black xs:h-app'>
        {/* Top Floating Header & Create Button */}
        <div
          className='pointer-events-auto absolute left-4 top-4 z-40 flex items-center gap-3'
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <Button
            className='flex items-center gap-2 rounded-full bg-main-accent/95 px-4 py-2 text-sm font-bold text-main-accent-contrast shadow-xl backdrop-blur-md transition hover:brightness-105 active:scale-95'
            onClick={() => setCreateOpen(true)}
          >
            <HeroIcon className='h-5 w-5' iconName='PlusIcon' />
            <span>إنشاء ريل</span>
          </Button>
        </div>

        {reelsLoading ? (
          <div className='flex flex-col items-center gap-3 text-white'>
            <Loading className='text-main-accent' />
            <p className='text-sm text-light-secondary dark:text-dark-secondary'>
              جاري تحميل الريلز...
            </p>
          </div>
        ) : !reels.length ? (
          <div className='flex max-w-sm flex-col items-center gap-5 px-6 text-center text-white'>
            <div className='flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-main-accent shadow-2xl backdrop-blur-md'>
              <HeroIcon className='h-10 w-10' iconName='FilmIcon' />
            </div>
            <div>
              <p className='text-2xl font-bold'>لا توجد ريلز بعد</p>
              <p className='mt-2 text-sm leading-relaxed text-light-secondary dark:text-dark-secondary'>
                كن أول من يشارك لحظاته المميزة بمقطع فيديو ريل ووصف مميز!
              </p>
            </div>
            <Button
              className='flex items-center gap-2 rounded-full bg-main-accent px-6 py-3 font-bold text-main-accent-contrast shadow-lg transition hover:brightness-105 active:scale-95'
              onClick={() => setCreateOpen(true)}
            >
              <HeroIcon className='h-5 w-5' iconName='PlusIcon' />
              <span>إنشاء أول ريل الآن</span>
            </Button>
          </div>
        ) : (
          <PullToRefresh
            onRefresh={handleRefresh}
            scrollRef={containerRef}
            disabled={createOpen || activeIndex > 0}
            variant='dark'
            className='h-full w-full'
          >
          <div
            ref={containerRef}
            className={`h-full w-full select-none snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth outline-none transition-opacity duration-150 [-webkit-tap-highlight-color:transparent] focus:outline-none ${
              deepLinkReady ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onScroll={handleScroll}
          >
            <AnimatePresence mode='popLayout'>
              {reels.map((reel, index) => {
                const owner =
                  userById.get(reel.userId) ?? fallbackUser(reel.userId);
                const isActive = index === activeIndex;

                return (
                  <div
                    key={reel.id}
                    className='relative flex h-app-nav w-full select-none snap-start snap-always items-center justify-center overflow-hidden outline-none focus:outline-none xs:h-app'
                  >
                    <div className='relative mx-auto h-full w-full max-w-md select-none outline-none focus:outline-none'>
                      <ReelCard reel={reel} user={owner} isActive={isActive} />
                    </div>
                  </div>
                );
              })}
            </AnimatePresence>
            <LoadMore />
          </div>
          </PullToRefresh>
        )}

        <CreateReelModal
          open={createOpen}
          closeModal={() => setCreateOpen(false)}
        />
      </div>
    </MainLayout>
  );
}

Reels.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>{page}</ProtectedLayout>
);
