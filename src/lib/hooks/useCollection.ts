import { useState, useEffect } from 'react';
import { getDoc, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { usersCollection } from '@lib/firebase/collections';
import { useCacheQuery } from './useCacheQuery';
import type { Query } from 'firebase/firestore';
import type { User } from '@lib/types/user';

type UseCollection<T> = {
  data: T[] | null;
  loading: boolean;
};

type DataWithRef<T> = (T & { createdBy: string })[];
type DataWithUser<T> = UseCollection<T & { user: User }>;

export type UseCollectionOptions = {
  includeUser?: boolean;
  allowNull?: boolean;
  disabled?: boolean;
  preserve?: boolean;
};

export function useCollection<T>(
  query: Query<T> | null,
  options: {
    includeUser: true;
    allowNull?: boolean;
    disabled?: boolean;
    preserve?: boolean;
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

  const cachedQuery = useCacheQuery(query);

  const { includeUser, allowNull, disabled, preserve } = options ?? {};

  useEffect(() => {
    if (disabled || !cachedQuery) {
      setLoading(false);
      return;
    }

    if (!preserve && data) {
      setData(null);
      setLoading(true);
    }

    const populateUser = async (currentData: DataWithRef<T>): Promise<void> => {
      const dataWithUser = await Promise.all(
        currentData.map(async (currentData) => {
          const fallbackUser: User = {
            id: currentData.createdBy || '',
            name: 'مستخدم مجهول',
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
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            totalTweets: 0,
            totalPhotos: 0,
            pinnedTweet: null,
            coverPhotoURL: null
          };

          if (!currentData.createdBy)
            return { ...currentData, user: fallbackUser };

          const userDoc = await getDoc(
            doc(usersCollection, currentData.createdBy)
          );
          const user = userDoc.data() ?? fallbackUser;
          return { ...currentData, user };
        })
      );
      setData(dataWithUser);
      setLoading(false);
    };

    const unsubscribe = onSnapshot(
      cachedQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) =>
          doc.data({ serverTimestamps: 'estimate' })
        );

        if (allowNull && !data.length) {
          setData(null);
          setLoading(false);
          return;
        }

        if (includeUser) void populateUser(data as DataWithRef<T>);
        else {
          setData(data);
          setLoading(false);
        }
      },
      (error) => {
        console.error('useCollection snapshot error:', error);
        setData([]);
        setLoading(false);
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedQuery, disabled]);

  return { data, loading };
}
