import { useState, useEffect } from 'react';
import { queryEqual } from 'firebase/firestore';
import type { Query } from 'firebase/firestore';

export function useCacheQuery<T>(
  query: Query<T> | null
): Query<T> | null {
  const [cachedQuery, setCachedQuery] = useState<Query<T> | null>(query);

  useEffect(() => {
    if (!query || !cachedQuery) {
      setCachedQuery(query);
      return;
    }
    if (!queryEqual(query, cachedQuery)) setCachedQuery(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return cachedQuery;
}
