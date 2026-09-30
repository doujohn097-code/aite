import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import { useReelsFeed } from '@lib/hooks/useReelsFeed';
import { useRankedFeed } from '@lib/hooks/useRankedFeed';
import { getTimestampMillis } from '@lib/date';
import { loadUsersByIds } from '@lib/firebase/users';
import type { RankableItem } from '@lib/feed-rank';
import type { Story } from '@lib/types/story';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { ReelSkeleton } from '@components/ui/skeleton';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ReelCard } from '@components/reels/reel-card';
import { CreateReelModal } from '@components/reels/create-reel-modal';
import type { ReactElement, ReactNode } from 'react';
import type { User } from '@lib/types/user';

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
  const { t } = useLanguage();
  const router = useRouter();
  const deepLinkId =
    typeof router.query.video === 'string' ? router.query.video : null;
  const [activeIndex, setActiveIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [deepLinkReady, setDeepLinkReady] = useState(!deepLinkId);
  const containerRef = useRef<HTMLDivElement>(null);
  const deepLinkDoneRef = useRef(false);

  const {
    reels: visibleReels,
    loading: reelsLoading,
    LoadMore
  } = useReelsFeed();

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

  const ownerIdsKey = ownerIds.join(',');
  const [userById, setUserById] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    if (!ownerIdsKey) {
      setUserById(new Map());
      return;
    }
    let cancelled = false;
    void loadUsersByIds(ownerIdsKey.split(',')).then((next) => {
      if (!cancelled) setUserById(next);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerIdsKey]);

  const ownersById = useMemo(() => {
    const map = new Map(userById);
    if (user?.id) map.set(user.id, user);
    return map;
  }, [user, userById]);

  useEffect(() => {
    // عند تغيّر طول القائمة نثبّت المؤشّر على آخر ريل صالح بدل القفز للأول.
    if (reels.length > 0 && activeIndex > reels.length - 1) {
      setActiveIndex(reels.length - 1);
    }
  }, [reels.length, activeIndex]);

  useEffect(() => {
    setDeepLinkReady(!deepLinkId);
    deepLinkDoneRef.current = false;
  }, [deepLinkId]);

  // Deep links must open on the requested reel without visibly traversing
  // every reel above it. Keep the feed hidden for one frame, jump instantly,
  // then reveal the target card. The jump runs once per deep link: the feed
  // re-ranks itself as owners and pages arrive, and re-running the jump would
  // yank the viewer back to the deep-linked reel mid-swipe.
  useEffect(() => {
    if (!deepLinkId || deepLinkDoneRef.current) {
      setDeepLinkReady(true);
      return;
    }
    if (!reels.length) return;
    const index = reels.findIndex((reel) => reel.id === deepLinkId);
    if (index < 0) {
      setDeepLinkReady(true);
      return;
    }
    deepLinkDoneRef.current = true;
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

  return (
    <MainLayout>
      <SEO title={t('reels.title')} />
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
            <span>{t('reels.create')}</span>
          </Button>
        </div>

        {reelsLoading ? (
          <div className='h-full w-full max-w-md'>
            <ReelSkeleton />
          </div>
        ) : !reels.length ? (
          <div className='flex max-w-sm flex-col items-center gap-5 px-6 text-center text-white'>
            <div className='flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-main-accent shadow-2xl backdrop-blur-md'>
              <HeroIcon className='h-10 w-10' iconName='FilmIcon' />
            </div>
            <div>
              <p className='text-2xl font-bold'>{t('reels.empty')}</p>
              <p className='mt-2 text-sm leading-relaxed text-light-secondary dark:text-dark-secondary'>
                {t('reels.emptyHint')}
              </p>
            </div>
            <Button
              className='flex items-center gap-2 rounded-full bg-main-accent px-6 py-3 font-bold text-main-accent-contrast shadow-lg transition hover:brightness-105 active:scale-95'
              onClick={() => setCreateOpen(true)}
            >
              <HeroIcon className='h-5 w-5' iconName='PlusIcon' />
              <span>{t('reels.createFirst')}</span>
            </Button>
          </div>
        ) : (
          <div
            ref={containerRef}
            data-scroll-root
            data-preserve-scroll='true'
            className={`h-full w-full select-none snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth outline-none transition-opacity duration-150 [-webkit-tap-highlight-color:transparent] focus:outline-none ${
              deepLinkReady ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onScroll={handleScroll}
          >
            {reels.map((reel, index) => {
              const owner = ownersById.get(reel.userId) ?? null;
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
          </div>
        )}

        {/* يبقى مؤشّر «المزيد» خارج سطح الانزلاق: داخله كان يضيف منطقة فارغة
            قابلة للالتقاط في نهاية التغذية. */}
        <div className='pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center'>
          <LoadMore />
        </div>

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
