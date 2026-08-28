import { useState, useEffect, useRef, useCallback } from 'react';
import { onSnapshot, getDocsFromServer } from 'firebase/firestore';
import { blankUser, loadUsersByIds } from '@lib/firebase/users';
import { registerPageRefresh } from '@lib/refresh-bus';
import { useCacheQuery } from './useCacheQuery';
import type { Query } from 'firebase/firestore';
import type { User } from '@lib/types/user';

type UseCollection<T> = {
  data: T[] | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

type DataWithRef<T> = (T & { createdBy: string })[];
type DataWithUser<T> = UseCollection<T & { user: User }>;

export type UseCollectionOptions = {
  includeUser?: boolean;
  allowNull?: boolean;
  disabled?: boolean;
  preserve?: boolean;
  refreshKey?: number;
};

export function useCollection<T>(
  query: Query<T> | null,
  options: {
    includeUser: true;
    allowNull?: boolean;
    disabled?: boolean;
    preserve?: boolean;
    refreshKey?: number;
  }
): DataWithUser<T>;

export function useCollection<T>(
  query: Query<T> | null,
  options?: UseCollectionOptions
): UseCollection<T>;

export function useCollection<T>(
  query: Query<T> | null,
  options?: UseCollectionOptions
): UseCollection<T> | DataWithUser<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLiveData = useRef(false);
  const applyId = useRef(0);
  const dataRef = useRef<T[] | null>(null);

  dataRef.current = data;

  const cachedQuery = useCacheQuery(query);

  const { includeUser, allowNull, disabled, preserve, refreshKey } =
    options ?? {};

  const applyRows = useCallback(
    async (rows: T[]): Promise<void> => {
      const token = ++applyId.current;

      if (allowNull && !rows.length) {
        setData([]);
        setLoading(false);
        return;
      }

      if (!includeUser) {
        setData(rows);
        setLoading(false);
        return;
      }

      const withRef = rows as DataWithRef<T>;
      const users = await loadUsersByIds(withRef.map((item) => item.createdBy));
      if (token !== applyId.current) return;

      setData(
        withRef.map((item) => ({
          ...item,
          user: users.get(item.createdBy) ?? blankUser(item.createdBy || '')
        })) as T[]
      );
      setLoading(false);
    },
    [allowNull, includeUser]
  );

  useEffect(() => {
    if (disabled || !cachedQuery) {
      setLoading(false);
      if (!preserve) setData(null);
      return;
    }

    if (!preserve) {
      hasLiveData.current = false;
      setData(null);
      setLoading(true);
    }

    const unsubscribe = onSnapshot(
      cachedQuery,
      (snapshot) => {
        hasLiveData.current = true;
        const rows = snapshot.docs.map((docSnapshot) =>
          docSnapshot.data({ serverTimestamps: 'estimate' })
        );
        void applyRows(rows);
      },
      (error) => {
        console.error('useCollection snapshot error:', error);
        if (!hasLiveData.current) setData([]);
        setLoading(false);
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedQuery, disabled, refreshKey, applyRows]);

  const refresh = useCallback(async (): Promise<void> => {
    if (disabled || !cachedQuery) return;
    // Visible reload: drop current rows and surface the loading state so
    // pull-to-refresh feels like a real re-fetch (skeletons show), not a
    // silent background update.
    const token = ++applyId.current;
    const previousData = dataRef.current;
    setData(null);
    setLoading(true);
    try {
      const snapshot = await getDocsFromServer(cachedQuery);
      hasLiveData.current = true;
      const rows = snapshot.docs.map((docSnapshot) =>
        docSnapshot.data({ serverTimestamps: 'estimate' })
      );
      await applyRows(rows);
    } catch (error) {
      console.error('useCollection refresh error:', error);
      if (applyId.current === token) {
        // Never leave the UI stuck on skeletons if the server fetch fails
        // (e.g. offline): restore the previous rows instead.
        setData(previousData ?? []);
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyRows, cachedQuery, disabled]);

  useEffect(() => {
    if (disabled || !cachedQuery) return;
    return registerPageRefresh(refresh);
  }, [cachedQuery, disabled, refresh]);

  return { data, loading, refresh };
}
