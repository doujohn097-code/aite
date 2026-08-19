import { Timestamp, type FirestoreDataConverter } from 'firebase/firestore';
import type { ImagesPreview } from './file';
import type { User } from './user';

export type Tweet = {
  id: string;
  text: string | null;
  images: ImagesPreview | null;
  parent: { id: string; username: string } | null;
  replyTo?: { id: string; username: string; name?: string; text?: string | null } | null;
  userLikes: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  userReplies: number;
  userRetweets: string[];
};

export type TweetWithUser = Tweet & { user: User };

export const tweetConverter: FirestoreDataConverter<Tweet> = {
  toFirestore(data) {
    const tweet = { ...data } as Record<string, unknown>;
    delete tweet.id;
    return tweet;
  },
  fromFirestore(snapshot, options) {
    const { id } = snapshot;
    const data = snapshot.data(options);

    return {
      id,
      text: null,
      images: null,
      parent: null,
      userLikes: [],
      createdBy: '',
      createdAt: Timestamp.now(),
      updatedAt: null,
      userReplies: 0,
      userRetweets: [],
      ...data
    } as Tweet;
  }
};
