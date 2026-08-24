/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { query, limit } from 'firebase/firestore';
import { Loading } from '@components/ui/loading';
import { useCollection } from './useCollection';
import type { UseCollectionOptions } from './useCollection';
import type { Query, QueryConstraint } from 'firebase/firestore';
import type { User } from '@lib/types/user';

type InfiniteScroll<T> = {
  data: T[] | null;
  loading: boolean;
  LoadMore: () => JSX.Element;
  refresh: () => Promise<void>;
};

type InfiniteScrollWithUser<T> = {
  data: (T & { user: User })[] | null;
  loading: boolean;
  LoadMore: () => JSX.Element;
  refresh: () => Promise<void>;
};

export function useInfiniteScroll<T>(
  collection: Query<T>,
  constraints: QueryConstraint[],
  fetchOptions: UseCollectionOptions & { includeUser: true },
  options?: { initialSize?: number; stepSize?: number; marginBottom?: number }
): InfiniteScrollWithUser<T>;

export function useInfiniteScroll<T>(
  collection: Query<T>,
  constraints: QueryConstraint[],
  fetchOptions?: UseCollectionOptions,
  options?: { initialSize?: number; stepSize?: number; marginBottom?: number }
): InfiniteScroll<T>;

export function useInfiniteScroll<T>(
  collection: Query<T>,
  queryConstraints?: QueryConstraint[],
  fetchOptions?: UseCollectionOptions,
  options?: { initialSize?: number; stepSize?: number; marginBottom?: number }
): InfiniteScroll<T> | InfiniteScrollWithUser<T> {
  const { initialSize, stepSize, marginBottom } = options ?? {};

  const [tweetsLimit, setTweetsLimit] = useState(initialSize ?? 20);
  const [reachedLimit, setReachedLimit] = useState(false);
  const [loadMoreInView, setLoadMoreInView] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const justIncreased = useRef(false);

  const { data, loading, refresh: refreshCollection } = useCollection(
    query(collection, ...(queryConstraints ?? []), limit(tweetsLimit)),
    { ...fetchOptions, preserve: true, refreshKey }
  );

  const refresh = useCallback(async (): Promise<void> => {
    setTweetsLimit(initialSize ?? 20);
    setReachedLimit(false);
    setRefreshKey((key) => key + 1);
    await refreshCollection();
  }, [initialSize, refreshCollection]);

  useEffect(() => {
    if (loading || data === null) return;
    if (justIncreased.current) {
      justIncreased.current = false;
      return;
    }
    setReachedLimit(data.length < tweetsLimit);
  }, [data, loading, tweetsLimit]);

  useEffect(() => {
    if (reachedLimit) return;
    if (loadMoreInView) {
      justIncreased.current = true;
      setTweetsLimit(tweetsLimit + (stepSize ?? 20));
    }
  }, [loadMoreInView]);

  const makeItInView = (): void => setLoadMoreInView(true);
  const makeItNotInView = (): void => setLoadMoreInView(false);

  const LoadMore = useCallback(
    (): JSX.Element => (
      <motion.div
        className={reachedLimit || loading ? 'hidden' : 'block'}
        viewport={{ margin: `0px 0px ${marginBottom ?? 1000}px` }}
        onViewportEnter={makeItInView}
        onViewportLeave={makeItNotInView}
      >
        <Loading className='mt-5' />
      </motion.div>
    ),
    [reachedLimit, loading]
  );

  return { data, loading, LoadMore, refresh };
}
