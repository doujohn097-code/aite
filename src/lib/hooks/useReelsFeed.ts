import { useMemo } from 'react';
import { storiesCollection } from '@lib/firebase/collections';
import { useInfiniteScroll } from '@lib/hooks/useInfiniteScroll';
import { isReelVisible, mergeReels, reelQueryConstraints } from '@lib/reels';
import { getTimestampMillis } from '@lib/date';
import type { QueryConstraint } from 'firebase/firestore';
import type { Story } from '@lib/types/story';

type ReelsFeed = {
  reels: Story[];
  loading: boolean;
  LoadMore: () => JSX.Element;
  refresh: () => Promise<void>;
};

/**
 * الريلز تسكن نفس مجموعة `stories` مع القصص العادية، وكان الاستعلام القديم يجلب
 * أول 50 مستنداً من كل شيء ثم يفلتر الريلز محلياً — فحين تكثر القصص (24 ساعة)
 * يصبح نصيب الريلز واحداً أو صفراً في الصفحة الأولى. هنا نستعلم عن الريلز
 * نفسها بفهرس kind + createdAt المركّب، ونُبقي نافذة إضافية للريلز القديمة
 * غير الموسومة، ثم ندمج المصدرين ونفلتر المنتهي.
 */
export function useReelsFeed(): ReelsFeed {
  const taggedConstraints = useMemo(() => reelQueryConstraints(), []);
  const legacyConstraints = useMemo<QueryConstraint[]>(() => [], []);

  const tagged = useInfiniteScroll(
    storiesCollection,
    taggedConstraints,
    { allowNull: true },
    { initialSize: 100, stepSize: 50 }
  );

  const legacy = useInfiniteScroll(
    storiesCollection,
    legacyConstraints,
    { allowNull: true },
    { initialSize: 100, stepSize: 100 }
  );

  const reels = useMemo(() => {
    const nowMs = Date.now();
    return mergeReels(tagged.data, legacy.data)
      .filter((story) => isReelVisible(story, nowMs))
      .sort(
        (a, b) =>
          getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
      );
  }, [tagged.data, legacy.data]);

  const LoadMore = tagged.LoadMore;

  const refresh = useMemo(
    () => async (): Promise<void> => {
      await Promise.allSettled([tagged.refresh(), legacy.refresh()]);
    },
    [tagged, legacy]
  );

  return {
    reels,
    loading: tagged.loading && legacy.loading,
    LoadMore,
    refresh
  };
}
