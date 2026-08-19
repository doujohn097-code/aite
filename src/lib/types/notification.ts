import type { Timestamp, FirestoreDataConverter } from 'firebase/firestore';

export type NotificationType =
  | 'like'
  | 'retweet'
  | 'follow'
  | 'reply'
  | 'message'
  | 'storyLike';

export type Notification = {
  id: string;
  type: NotificationType;
  fromUserId: string;
  toUserId: string;
  tweetId?: string | null;
  storyId?: string | null;
  storyUserId?: string | null;
  messageText?: string | null;
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
    return {
      id,
      type: 'follow',
      fromUserId: '',
      toUserId: '',
      tweetId: null,
      storyId: null,
      storyUserId: null,
      messageText: null,
      read: false,
      createdAt: null,
      ...data
    } as Notification;
  }
};
