import { useEffect, useMemo, useRef, useState } from 'react';
import {
  isFeedMode,
  rankItems,
  sessionSeed,
  stabilizeFeed,
  type FeedMode,
  type RankableItem,
  type RankContext
} from '@lib/feed-rank';

type Options<T> = {
  storageKey: string;
  mapItem: (item: T) => RankableItem;
  viewerId: string | null;
  following: readonly string[];
  kind: 'post' | 'reel';
  defaultMode?: FeedMode;
};

export function usePersistedFeedMode(
  storageKey: string,
  defaultMode: FeedMode = 'pulse'
): [FeedMode, (mode: FeedMode) => void] {
  const [mode, setMode] = useState<FeedMode>(defaultMode);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (isFeedMode(stored)) setMode(stored);
    } catch {
      /* private mode */
    }
  }, [storageKey]);

  const update = (next: FeedMode): void => {
    setMode(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  };

  return [mode, update];
}

export function useRankedFeed<T>(
  items: readonly T[] | null | undefined,
  {
    storageKey,
    mapItem,
    viewerId,
    following,
    kind,
    defaultMode = 'pulse'
  }: Options<T>
): {
  mode: FeedMode;
  setMode: (mode: FeedMode) => void;
  ranked: T[];
} {
  const [mode, setMode] = usePersistedFeedMode(storageKey, defaultMode);
  const nowMs = useMemo(() => Date.now(), []);
  const previousRef = useRef<T[]>([]);
  const previousMode = useRef<FeedMode>(mode);
  const followingKey = following.join(',');

  const ranked = useMemo(() => {
    const list = items ?? [];
    const ctx: RankContext = {
      viewerId,
      following,
      nowMs,
      mode,
      seed: sessionSeed(viewerId, nowMs),
      kind
    };
    const next = rankItems(list, mapItem, ctx);
    if (previousMode.current !== mode) {
      previousMode.current = mode;
      previousRef.current = next;
      return next;
    }
    const stable = stabilizeFeed(previousRef.current, next, (item) =>
      mapItem(item).id
    );
    previousRef.current = stable;
    return stable;
    // followingKey stands in for the following array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, mode, viewerId, followingKey, nowMs, kind, mapItem]);

  return { mode, setMode, ranked };
}
