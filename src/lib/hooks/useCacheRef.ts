import { useState, useEffect } from 'react';
import { refEqual } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';

export function useCacheRef<T>(
  ref: DocumentReference<T> | null
): DocumentReference<T> | null {
  const [cachedRef, setCachedRef] = useState<DocumentReference<T> | null>(ref);

  useEffect(() => {
    if (!ref || !cachedRef) {
      setCachedRef(ref);
      return;
    }
    if (!refEqual(ref, cachedRef)) setCachedRef(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return cachedRef;
}
