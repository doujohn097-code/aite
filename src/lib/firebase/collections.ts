import { collection } from 'firebase/firestore';
import { userConverter } from '@lib/types/user';
import { tweetConverter } from '@lib/types/tweet';
import { bookmarkConverter } from '@lib/types/bookmark';
import { statsConverter } from '@lib/types/stats';
import {
  conversationConverter,
  messageConverter
} from '@lib/types/message';
import { notificationConverter } from '@lib/types/notification';
import { storyConverter } from '@lib/types/story';
import { db } from './app';
import type { CollectionReference } from 'firebase/firestore';
import type { Bookmark } from '@lib/types/bookmark';
import type { Stats } from '@lib/types/stats';
import type { Message } from '@lib/types/message';
import type { Notification } from '@lib/types/notification';

export const usersCollection = collection(db, 'users').withConverter(
  userConverter
);

export const tweetsCollection = collection(db, 'tweets').withConverter(
  tweetConverter
);

export const conversationsCollection = collection(db, 'conversations').withConverter(
  conversationConverter
);

export function userBookmarksCollection(
  id: string
): CollectionReference<Bookmark> {
  return collection(db, `users/${id}/bookmarks`).withConverter(
    bookmarkConverter
  );
}

export function userStatsCollection(id: string): CollectionReference<Stats> {
  return collection(db, `users/${id}/stats`).withConverter(statsConverter);
}

export function messagesCollection(
  conversationId: string
): CollectionReference<Message> {
  return collection(
    db,
    `conversations/${conversationId}/messages`
  ).withConverter(messageConverter);
}

export function notificationsCollection(
  userId: string
): CollectionReference<Notification> {
  return collection(
    db,
    `users/${userId}/notifications`
  ).withConverter(notificationConverter);
}

export const storiesCollection = collection(db, 'stories').withConverter(
  storyConverter
);
