import { useSyncExternalStore } from 'react';
import { onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { collectionsFor } from '@lib/firebase/collections';

// Must comfortably exceed the heartbeat interval in auth-context so dots
// never flicker offline between beats; a 12-minute window pairs with the
// 5-minute heartbeat to cut Firestore write quota ~5x.
const ONLINE_WINDOW_MS = 12 * 60 * 1000;

/**
 * Shared realtime map of online users (heartbeat within the last 2.5
 * minutes). One Firestore listener serves every green presence dot in
 * the app. Stale entries are re-evaluated locally every 30 seconds so
 * users fade out without extra reads.
 */
let online: Record<string, number> = {};
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;
let pruneTimer: ReturnType<typeof setInterval> | null = null;

function prune(): void {
  const now = Date.now();
  let changed = false;
  for (const [key, millis] of Object.entries(online))
    if (now - millis > ONLINE_WINDOW_MS) {
      delete online[key];
      changed = true;
    }
  if (changed) listeners.forEach((listener) => listener());
}

function ensureListener(): void {
  if (unsubscribe) return;

  const cutoff = Timestamp.fromMillis(Date.now() - ONLINE_WINDOW_MS);

  const merge = (next: Record<string, number>): void => {
    const merged: Record<string, number> = { ...online, ...next };
    online = merged;
    listeners.forEach((listener) => listener());
  };

  // Listen on BOTH round-robin databases so presence from either project
  // shows up. Errors leave the other side working.
  const unsubA = onSnapshot(
    query(collectionsFor('a').users, where('lastActiveAt', '>', cutoff)),
    (snapshot) => {
      const next: Record<string, number> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const millis = data.lastActiveAt?.toMillis?.() ?? 0;
        next[docSnap.id] = millis;
        const username = data.username as string | undefined;
        if (username) next[username] = millis;
      });
      merge(next);
    },
    () => undefined
  );
  const unsubB = onSnapshot(
    query(collectionsFor('b').users, where('lastActiveAt', '>', cutoff)),
    (snapshot) => {
      const next: Record<string, number> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const millis = data.lastActiveAt?.toMillis?.() ?? 0;
        next[docSnap.id] = millis;
        const username = data.username as string | undefined;
        if (username) next[username] = millis;
      });
      merge(next);
    },
    () => undefined
  );

  unsubscribe = (): void => {
    unsubA();
    unsubB();
  };

  pruneTimer = setInterval(prune, 30_000);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureListener();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      unsubscribe?.();
      unsubscribe = null;
      if (pruneTimer) {
        clearInterval(pruneTimer);
        pruneTimer = null;
      }
    }
  };
}

function getSnapshot(): Record<string, number> {
  return online;
}

function getServerSnapshot(): Record<string, number> {
  return online;
}

/**
 * Check whether a user (by id or username) is currently online.
 */
export function useOnlineStatus(key?: string | null): boolean {
  const map = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!key) return false;
  const millic = map[key];
  return !!millic && Date.now() - millic <= ONLINE_WINDOW_MS;
}
