import { useEffect, useState } from 'react';
import { getDocs, limit, query, where } from 'firebase/firestore';
import { usersCollection } from '@lib/firebase/collections';
import type { User } from '@lib/types/user';

const CACHE = new Map<string, { at: number; users: User[] }>();
const CACHE_MS = 20_000;

export function useMentionSearch(
  rawQuery: string | null,
  excludeId?: string | null
): { users: User[]; loading: boolean } {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const prefix = (rawQuery ?? '').trim().replace(/^@/, '').toLowerCase();
    if (!rawQuery || prefix.length < 1) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = CACHE.get(prefix);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setUsers(cached.users.filter((user) => user.id !== excludeId));
      setLoading(false);
      return;
    }

    setLoading(true);

    const run = async (): Promise<void> => {
      try {
        const snapshot = await getDocs(
          query(
            usersCollection,
            where('username', '>=', prefix),
            where('username', '<=', `${prefix}\uf8ff`),
            limit(8)
          )
        );
        const next = snapshot.docs
          .map((docSnap) => docSnap.data())
          .filter((user) => user.username && user.id !== excludeId);
        CACHE.set(prefix, { at: Date.now(), users: next });
        if (!cancelled) setUsers(next);
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [rawQuery, excludeId]);

  return { users, loading };
}
