import { collection } from 'firebase/firestore';
import { getFirebase } from './app';
import { userConverter } from '@lib/types/user';
import { tweetConverter } from '@lib/types/tweet';
import { bookmarkConverter } from '@lib/types/bookmark';
import { statsConverter } from '@lib/types/stats';
import { notificationConverter } from '@lib/types/notification';
import { storyConverter } from '@lib/types/story';
import { conversationConverter, messageConverter } from '@lib/types/message';
import type { ProjectId } from '@lib/project-types';
import type { Firestore } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import type { User } from '@lib/types/user';
import type { Tweet } from '@lib/types/tweet';
import type { Bookmark } from '@lib/types/bookmark';
import type { Stats } from '@lib/types/stats';
import type { Notification } from '@lib/types/notification';
import type { Story } from '@lib/types/story';
import type { Conversation, Message } from '@lib/types/message';

export type Collections = {
  users: CollectionReference<User>;
  tweets: CollectionReference<Tweet>;
  stories: CollectionReference<Story>;
  conversations: CollectionReference<Conversation>;
  userBookmarks: (id: string) => CollectionReference<Bookmark>;
  userStats: (id: string) => CollectionReference<Stats>;
  notifications: (id: string) => CollectionReference<Notification>;
  conversationMessages: (id: string) => CollectionReference<Message>;
};

/** Builds every collection reference against a specific project's Firestore. */
export function collectionsFor(
  project: ProjectId,
  firestore?: Firestore
): Collections {
  const db = firestore ?? getFirebase(project).firestore;
  return {
    users: collection(db, 'users').withConverter(userConverter),
    tweets: collection(db, 'tweets').withConverter(tweetConverter),
    stories: collection(db, 'stories').withConverter(storyConverter),
    conversations: collection(db, 'conversations').withConverter(
      conversationConverter
    ),
    userBookmarks: (id) =>
      collection(db, `users/${id}/bookmarks`).withConverter(bookmarkConverter),
    userStats: (id) =>
      collection(db, `users/${id}/stats`).withConverter(statsConverter),
    notifications: (id) =>
      collection(db, `users/${id}/notifications`).withConverter(
        notificationConverter
      ),
    conversationMessages: (id) =>
      collection(db, `conversations/${id}/messages`).withConverter(
        messageConverter
      )
  };
}

// Legacy default bindings (primary project) — keep existing imports working.
const legacy = collectionsFor('a');

export const usersCollection = legacy.users;
export const tweetsCollection = legacy.tweets;
export const storiesCollection = legacy.stories;
export const conversationsCollection = legacy.conversations;

export function userBookmarksCollection(
  id: string
): CollectionReference<Bookmark> {
  return legacy.userBookmarks(id);
}

export function userStatsCollection(id: string): CollectionReference<Stats> {
  return legacy.userStats(id);
}

export function notificationsCollection(
  userId: string
): CollectionReference<Notification> {
  return legacy.notifications(userId);
}

export function conversationMessagesCollection(
  id: string
): CollectionReference<Message> {
  return legacy.conversationMessages(id);
}
