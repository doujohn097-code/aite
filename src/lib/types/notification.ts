import type { Timestamp, FirestoreDataConverter } from 'firebase/firestore';

export type NotificationType =
  | 'like'
  | 'retweet'
  | 'follow'
  | 'reply'
  | 'storyLike'
  | 'mention';

export type NotificationContext = 'post' | 'reel' | 'story';

export type Notification = {
  id: string;
  type: NotificationType;
  fromUserId: string;
  toUserId: string;
  tweetId?: string | null;
  storyId?: string | null;
  storyUserId?: string | null;
  context?: NotificationContext | null;
  fromName?: string | null;
  fromUsername?: string | null;
  fromPhotoURL?: string | null;
  read: boolean;
  createdAt: Timestamp | null;
};

export const notificationConverter: FirestoreDataConverter<Notification> = {
  toFirestore(data) {
    const notification = { ...data } as Record<string, unknown>;
    delete notification.id;
    return notification;
  },
  fromFirestore(snapshot, options) {
    const { id } = snapshot;
    const data = snapshot.data(options);
    const fromUserId =
      (typeof data.fromUserId === 'string' && data.fromUserId) ||
      (typeof data.userId === 'string' && data.userId) ||
      '';
    return {
      id,
      type: 'follow',
      toUserId: '',
      tweetId: null,
      storyId: null,
      storyUserId: null,
      fromName: null,
      fromUsername: null,
      fromPhotoURL: null,
      read: false,
      createdAt: null,
      ...data,
      fromUserId
    } as Notification;
  }
};
