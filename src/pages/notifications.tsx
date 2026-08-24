import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  query,
  orderBy,
  where,
  onSnapshot,
  getDocs,
  getDocsFromServer,
  writeBatch
} from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import { db } from '@lib/firebase/app';
import { notificationsCollection } from '@lib/firebase/collections';
import { loadUsersByIds } from '@lib/firebase/users';
import type { User } from '@lib/types/user';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { SEO } from '@components/common/seo';
import { HeroIcon } from '@components/ui/hero-icon';
import { NotificationCard } from '@components/notifications/notification-card';
import { NotificationFeedSkeleton } from '@components/ui/skeleton';
import { usePageRefresh } from '@lib/hooks/usePageRefresh';
import type { ReactElement, ReactNode } from 'react';
import type { Notification } from '@lib/types/notification';

export default function Notifications(): JSX.Element {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [notifications, setNotifications] = useState<Notification[] | null>(
    null
  );
  const [authors, setAuthors] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    if (!user) return;

    const notificationsQuery = query(
      notificationsCollection(user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docSnapshot) =>
          docSnapshot.data({ serverTimestamps: 'estimate' })
        );
        setNotifications(data);
      },
      (error) => {
        console.error('notifications snapshot error:', error);
        setNotifications([]);
      }
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const markRead = async (): Promise<void> => {
      const unreadQuery = query(
        notificationsCollection(user.id),
        where('read', '==', false)
      );

      const snapshot = await getDocs(unreadQuery);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnapshot) => {
        batch.update(docSnapshot.ref, { read: true });
      });

      await batch.commit();
    };

    void markRead();
  }, [user]);

  const authorIdsKey = useMemo(() => {
    if (!notifications?.length) return '';
    return Array.from(
      new Set(notifications.map((item) => item.fromUserId).filter(Boolean))
    )
      .sort()
      .join(',');
  }, [notifications]);

  useEffect(() => {
    if (!authorIdsKey) {
      setAuthors(new Map());
      return;
    }
    let cancelled = false;
    void loadUsersByIds(authorIdsKey.split(',')).then((next) => {
      if (!cancelled) setAuthors(next);
    });
    return () => {
      cancelled = true;
    };
  }, [authorIdsKey]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    if (!user) return;
    const snapshot = await getDocsFromServer(
      query(notificationsCollection(user.id), orderBy('createdAt', 'desc'))
    );
    const next = snapshot.docs.map((docSnapshot) =>
      docSnapshot.data({ serverTimestamps: 'estimate' })
    );
    setNotifications(next);
    const ids = Array.from(
      new Set(next.map((item) => item.fromUserId).filter(Boolean))
    );
    if (ids.length) setAuthors(await loadUsersByIds(ids));
  }, [user]);

  usePageRefresh(handleRefresh);

  return (
    <MainContainer>
      <SEO title={t('notif.title')} />
      <MainHeader title={t('notif.heading')} />
      {notifications === null ? (
        <NotificationFeedSkeleton />
      ) : notifications.length ? (
        <section>
          {notifications.map((notification) => (
            <NotificationCard
              notification={notification}
              key={notification.id}
            />
          ))}
        </section>
      ) : (
        <div className='flex flex-col items-center gap-4 p-12 text-center'>
          <div className='flex h-20 w-20 items-center justify-center rounded-full bg-main-accent/10 text-main-accent-text'>
            <HeroIcon className='h-10 w-10' iconName='BellIcon' />
          </div>
          <p className='text-2xl font-bold'>{t('notif.empty')}</p>
          <p className='max-w-xs text-light-secondary dark:text-dark-secondary'>
            {t('notif.emptyHint')}
          </p>
        </div>
      )}
    </MainContainer>
  );
}

Notifications.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);
