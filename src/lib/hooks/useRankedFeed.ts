import { useMemo } from 'react';
import {
  rankItems,
  sessionSeed,
  type RankableItem,
  type RankContext
} from '@lib/feed-rank';

type Options<T> = {
  mapItem: (item: T) => RankableItem;
  viewerId: string | null;
  following: readonly string[];
  kind: 'post' | 'reel';
};

export function useRankedFeed<T>(
  items: readonly T[] | null | undefined,
  { mapItem, viewerId, following, kind }: Options<T>
): T[] {
  const nowMs = useMemo(() => Date.now(), []);
  const followingKey = following.join(',');

  return useMemo(() => {
    const list = items ?? [];
    const ctx: RankContext = {
      viewerId,
      following,
      nowMs,
      seed: sessionSeed(viewerId, nowMs),
      kind
    };
    return rankItems(list, mapItem, ctx);
    // followingKey stands in for the following array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, viewerId, followingKey, nowMs, kind, mapItem]);
}
