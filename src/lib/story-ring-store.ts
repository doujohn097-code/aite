import { useSyncExternalStore } from 'react';
import { onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { usersCollection } from '@lib/firebase/collections';

type RingInfo = {
  lastStoryAt: Timestamp;
  storyColor: string | null;
};

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * Shared realtime map of users who currently have an active (24h) story.
 * One Firestore listener serves every story ring in the app (timeline
 * avatars, cards, sidebars...), so rings stay in sync with zero extra
 * reads per avatar.
 */
let cache: Record<string, RingInfo> = {};
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;

function ensureListener(): void {
  if (unsubscribe) return;

  const oneDayAgo = Timestamp.fromMillis(Date.now() - STORY_LIFETIME_MS);
  unsubscribe = onSnapshot(
    query(usersCollection, where('lastStoryAt', '>', oneDayAgo)),
    (snapshot) => {
      const next: Record<string, RingInfo> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.lastStoryAt)
          next[docSnap.id] = {
            lastStoryAt: data.lastStoryAt as Timestamp,
            storyColor: (data.storyColor as string | null) ?? null
          };
      });
      cache = next;
      listeners.forEach((listener) => listener());
    },
    () => {
      // Permission errors (logged out) just leave the cache empty
      cache = {};
    }
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureListener();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      unsubscribe?.();
      unsubscribe = null;
    }
  };
}

function getSnapshot(): Record<string, RingInfo> {
  return cache;
}

function getServerSnapshot(): Record<string, RingInfo> {
  return cache;
}

export function useStoryRingMap(): Record<string, RingInfo> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
