import { useState, useEffect } from 'react';
import { onSnapshot, Timestamp } from 'firebase/firestore';
import { fetchUserAnywhere, queryViaProxy } from '@lib/dual';
import { useCacheRef } from './useCacheRef';
import type { DocumentReference } from 'firebase/firestore';
import type { User } from '@lib/types/user';

const defaultUser: User = {
  id: '',
  bio: null,
  name: 'مستخدم مجهول',
  theme: null,
  accent: null,
  website: null,
  location: null,
  username: 'unknown',
  photoURL: '/assets/default-avatar.png',
  verified: false,
  following: [],
  followers: [],
  createdAt: Timestamp.now(),
  updatedAt: null,
  totalTweets: 0,
  totalPhotos: 0,
  pinnedTweet: null,
  coverPhotoURL: null
};

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

  const cachedDocRef = useCacheRef(docRef);

  const { includeUser, allowNull, disabled } = options ?? {};

  useEffect(() => {
    if (disabled || !cachedDocRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setData(null);
    setLoading(true);

    const populateUser = async (currentData: DataWithRef<T>): Promise<void> => {
      const fallbackUser = { ...defaultUser, id: currentData.createdBy || '' };

      if (!currentData.createdBy) {
        setData({ ...currentData, user: fallbackUser });
        setLoading(false);
        return;
      }

      try {
        // The author's profile may live in either round-robin database.
        const user =
          (await fetchUserAnywhere(currentData.createdBy)) ?? fallbackUser;
        const dataWithUser = { ...currentData, user };

        setData(dataWithUser);
      } catch (error) {
        console.error('populateUser error:', error);
        setData({ ...currentData, user: fallbackUser });
      }
      setLoading(false);
    };

    let disposed = false;

    /** Server-proxy fallback for blocked channels: reads the doc through our
     * origin (admin SDK) when the live subscription cannot reach Firestore. */
    const fetchViaProxy = async (): Promise<void> => {
      const parts = cachedDocRef.path.split('/');
      const collectionName = parts[0];
      const docId = parts[1];
      if (parts.length !== 2 || !docId) {
        if (!disposed) setLoading(false);
        return;
      }
      if (
        !['tweets', 'stories', 'users', 'conversations'].includes(
          collectionName
        )
      ) {
        if (!disposed) setLoading(false);
        return;
      }
      for (const project of ['a', 'b'] as const) {
        const items = await queryViaProxy(project, {
          collection: collectionName as
            | 'tweets'
            | 'stories'
            | 'users'
            | 'conversations',
          ids: [docId],
          limit: 1
        });
        if (disposed) return;
        if (items?.length) {
          const data = items[0].data as T;
          if (includeUser) void populateUser(data as DataWithRef<T>);
          else {
            setData(data);
            setLoading(false);
          }
          return;
        }
      }
      if (!disposed) setLoading(false);
    };

    const unsubscribe = onSnapshot(
      cachedDocRef,
      (snapshot) => {
        const data = snapshot.data({ serverTimestamps: 'estimate' });

        if (allowNull && !data) {
          setData(null);
          setLoading(false);
          return;
        }

        if (includeUser) void populateUser(data as DataWithRef<T>);
        else {
          setData(data as T);
          setLoading(false);
        }
      },
      (error) => {
        console.error('useDocument snapshot error:', error);
        // The channel may be blocked — try the server-side proxy.
        void fetchViaProxy();
      }
    );

    return () => {
      disposed = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedDocRef]);

  return { data, loading };
}
