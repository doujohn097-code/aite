import { useEffect, useState } from 'react';
import { getUserByUsernameOrId } from '@lib/firebase/users';
import type { User } from '@lib/types/user';

export type ResolvedProfileStatus = 'idle' | 'loading' | 'ready' | 'missing';

const cache = new Map<string, User | null>();
const inflight = new Map<string, Promise<User | null>>();

function loadProfile(handle: string): Promise<User | null> {
  const key = handle.toLowerCase();
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = getUserByUsernameOrId(handle)
    .then((user) => {
      cache.set(key, user);
      if (user?.id) cache.set(user.id.toLowerCase(), user);
      if (user?.username) cache.set(user.username.toLowerCase(), user);
      return user;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

export function useResolvedProfile(handle: string | null): {
  user: User | null;
  status: ResolvedProfileStatus;
} {
  const cached = handle ? cache.get(handle.toLowerCase()) : undefined;
  const [user, setUser] = useState<User | null>(cached ?? null);
  const [status, setStatus] = useState<ResolvedProfileStatus>(
    !handle
      ? 'idle'
      : cached === undefined
      ? 'loading'
      : cached
      ? 'ready'
      : 'missing'
  );

  useEffect(() => {
    if (!handle) {
      setUser(null);
      setStatus('idle');
      return;
    }
    const hit = cache.get(handle.toLowerCase());
    if (hit !== undefined) {
      setUser(hit);
      setStatus(hit ? 'ready' : 'missing');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    void loadProfile(handle).then((next) => {
      if (cancelled) return;
      setUser(next);
      setStatus(next ? 'ready' : 'missing');
    });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return { user, status };
}
