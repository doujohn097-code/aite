import { useState, useEffect, useRef, useCallback } from 'react';
import { getDoc, getDocFromServer, doc, onSnapshot } from 'firebase/firestore';
import { usersCollection } from '@lib/firebase/collections';
import { blankUser } from '@lib/firebase/users';
import { registerPageRefresh } from '@lib/refresh-bus';
import { useCacheRef } from './useCacheRef';
import type { DocumentReference } from 'firebase/firestore';
import type { User } from '@lib/types/user';

type UseDocument<T> = {
  data: T | null;
  loading: boolean;
};

type DataWithRef<T> = T & { createdBy: string };
type DataWithUser<T> = UseDocument<T & { user: User }>;

export function useDocument<T>(
  docRef: DocumentReference<T> | null,
  options: { includeUser: true; allowNull?: boolean; disabled?: boolean }
): DataWithUser<T>;

export function useDocument<T>(
  docRef: DocumentReference<T> | null,
  options?: { includeUser?: false; allowNull?: boolean; disabled?: boolean }
): UseDocument<T>;

export function useDocument<T>(
  docRef: DocumentReference<T> | null,
  options?: { includeUser?: boolean; allowNull?: boolean; disabled?: boolean }
): UseDocument<T> | DataWithUser<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLiveData = useRef(false);
  const dataRef = useRef<T | null>(null);

  dataRef.current = data;

  const cachedDocRef = useCacheRef(docRef);

  const { includeUser, allowNull, disabled } = options ?? {};

  useEffect(() => {
    if (disabled || !cachedDocRef) {
      setData(null);
      setLoading(false);
      return;
    }

    hasLiveData.current = false;
    setData(null);
    setLoading(true);

    const populateUser = async (currentData: DataWithRef<T>): Promise<void> => {
      if (!currentData.createdBy) {
        setData({ ...currentData, user: blankUser() });
        setLoading(false);
        return;
      }

      try {
        const userData = await getDoc(
          doc(usersCollection, currentData.createdBy)
        );
        setData({
          ...currentData,
          user: userData.data() ?? blankUser(currentData.createdBy)
        });
      } catch (error) {
        console.error('populateUser error:', error);
        setData({
          ...currentData,
          user: blankUser(currentData.createdBy)
        });
      }
      setLoading(false);
    };

    const unsubscribe = onSnapshot(
      cachedDocRef,
      (snapshot) => {
        hasLiveData.current = true;
        const next = snapshot.data({ serverTimestamps: 'estimate' });

        if (allowNull && !next) {
          setData(null);
          setLoading(false);
          return;
        }

        if (includeUser) void populateUser(next as DataWithRef<T>);
        else {
          setData(next as T);
          setLoading(false);
        }
      },
      (error) => {
        console.error('useDocument snapshot error:', error);
        if (!hasLiveData.current) setData(null);
        setLoading(false);
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedDocRef, disabled]);

  const refresh = useCallback(async (): Promise<void> => {
    if (disabled || !cachedDocRef) return;
    // Visible reload: drop the current doc and surface the loading state so
    // pull-to-refresh feels like a real re-fetch (skeletons show), not a
    // silent background update.
    hasLiveData.current = false;
    const previousData = dataRef.current;
    setData(null);
    setLoading(true);
    try {
      const snapshot = await getDocFromServer(cachedDocRef);
      hasLiveData.current = true;
      const next = snapshot.data({ serverTimestamps: 'estimate' });
      if (allowNull && !next) {
        setData(null);
        setLoading(false);
        return;
      }
      if (!includeUser) {
        setData((next as T) ?? null);
        setLoading(false);
        return;
      }
      const currentData = next as DataWithRef<T>;
      if (!currentData?.createdBy) {
        setLoading(false);
        return;
      }
      const userData = await getDoc(
        doc(usersCollection, currentData.createdBy)
      );
      setData({
        ...currentData,
        user: userData.data() ?? blankUser(currentData.createdBy)
      });
      setLoading(false);
    } catch (error) {
      console.error('useDocument refresh error:', error);
      // Never leave the UI stuck on skeletons if the server fetch fails
      // (e.g. offline): restore the previous document instead.
      setData(previousData);
      setLoading(false);
    }
  }, [allowNull, cachedDocRef, disabled, includeUser]);

  useEffect(() => {
    if (disabled || !cachedDocRef) return;
    return registerPageRefresh(refresh);
  }, [cachedDocRef, disabled, refresh]);

  return { data, loading };
}
