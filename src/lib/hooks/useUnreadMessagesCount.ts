import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { conversationsCollection } from '@lib/firebase/collections';
import { useAuth } from '@lib/context/auth-context';
import type { Conversation } from '@lib/types/message';

export function useUnreadMessagesCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const conversationsQuery = query(
      conversationsCollection,
      where('participants', 'array-contains', user.id)
    );

    return onSnapshot(
      conversationsQuery,
      (snapshot) => {
        let total = 0;
        snapshot.forEach((document) => {
          const data = document.data() as Conversation;
          total += data.unread?.[user.id] ?? 0;
        });
        setCount(total);
      },
      () => setCount(0)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return count;
}
