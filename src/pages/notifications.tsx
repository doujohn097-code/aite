import { useEffect, useState } from 'react';
import {
  query,
  orderBy,
  where,
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { db } from '@lib/firebase/app';
import { notificationsCollection } from '@lib/firebase/collections';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { SEO } from '@components/common/seo';
import { Loading } from '@components/ui/loading';
import { HeroIcon } from '@components/ui/hero-icon';
import { NotificationCard } from '@components/notifications/notification-card';
import { PullToRefresh } from '@components/common/pull-to-refresh';
import type { ReactElement, ReactNode } from 'react';
import type { Notification } from '@lib/types/notification';

export default function Notifications(): JSX.Element {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<Notification[] | null>(
    null
  );

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

  const handleRefresh = async (): Promise<void> => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise((resolve) => window.setTimeout(resolve, 380));
  };

  return (
    <MainContainer>
      <PullToRefresh onRefresh={handleRefresh}>
      <SEO title='الإشعارات / Aite' />
      <MainHeader title='الإشعارات' />
      {notifications === null ? (
        <Loading className='mt-5' />
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
          <p className='text-2xl font-bold'>لا توجد إشعارات</p>
          <p className='max-w-xs text-light-secondary dark:text-dark-secondary'>
            عندما يتفاعل أحدهم مع منشوراتك أو يتابعك، ستظهر التنبيهات هنا.
          </p>
        </div>
      )}
      </PullToRefresh>
    </MainContainer>
  );
}

Notifications.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);
