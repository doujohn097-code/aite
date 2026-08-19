import type { Timestamp, FirestoreDataConverter } from 'firebase/firestore';

export type Stats = {
  likes: string[];
  tweets: string[];
  /** Reel ids this user has reposted (reel retweets). */
  reels?: string[] | null;
  updatedAt: Timestamp | null;
};

export const statsConverter: FirestoreDataConverter<Stats> = {
  toFirestore(stats) {
    return { ...stats };
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options);

    return {
      likes: [],
      tweets: [],
      updatedAt: null,
      ...data
    } as Stats;
  }
};
