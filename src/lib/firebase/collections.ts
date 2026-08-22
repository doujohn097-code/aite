import { collection } from 'firebase/firestore';
import { userConverter } from '@lib/types/user';
import { tweetConverter } from '@lib/types/tweet';
import { bookmarkConverter } from '@lib/types/bookmark';
import { statsConverter } from '@lib/types/stats';
import { notificationConverter } from '@lib/types/notification';
import { storyConverter } from '@lib/types/story';
import { conversationConverter, messageConverter } from '@lib/types/message';
import { db } from './app';
import type { CollectionReference } from 'firebase/firestore';
import type { Bookmark } from '@lib/types/bookmark';
import type { Stats } from '@lib/types/stats';
import type { Notification } from '@lib/types/notification';
import type { Conversation, Message } from '@lib/types/message';

export const usersCollection = collection(db, 'users').withConverter(
  userConverter
);

export const tweetsCollection = collection(db, 'tweets').withConverter(
  tweetConverter
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

export function notificationsCollection(
  userId: string
): CollectionReference<Notification> {
  return collection(db, `users/${userId}/notifications`).withConverter(
    notificationConverter
  );
}

export const storiesCollection = collection(db, 'stories').withConverter(
  storyConverter
);

export const conversationsCollection = collection(
  db,
  'conversations'
).withConverter(conversationConverter);

export function conversationMessagesCollection(
  id: string
): CollectionReference<Message> {
  return collection(db, `conversations/${id}/messages`).withConverter(
    messageConverter
  );
}
