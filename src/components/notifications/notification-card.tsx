import Link from 'next/link';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { useDocument } from '@lib/hooks/useDocument';
import {
  usersCollection,
  notificationsCollection
} from '@lib/firebase/collections';
import { formatDate } from '@lib/date';
import {
  notificationCopy,
  notificationHref,
  resolveNotificationContext
} from '@lib/notification-target';
import { UserAvatar } from '@components/user/user-avatar';
import { HeroIcon } from '@components/ui/hero-icon';
import { NotificationSkeleton, Skeleton } from '@components/ui/skeleton';
import { visibleProfileName, visibleUsername } from '@lib/utils';
import cn from 'clsx';
import type { Notification } from '@lib/types/notification';
import type { IconName } from '@components/ui/hero-icon';

const typeStyles: Record<
  Notification['type'],
  { icon: IconName; classes: string }
> = {
  like: {
    icon: 'HeartIcon',
    classes: 'bg-rose-500/50 text-rose-100 backdrop-blur-md'
  },
  storyLike: {
    icon: 'HeartIcon',
    classes: 'bg-rose-500/50 text-rose-100 backdrop-blur-md'
  },
  retweet: {
    icon: 'ArrowPathRoundedSquareIcon',
    classes: 'bg-emerald-500/50 text-emerald-100 backdrop-blur-md'
  },
  follow: {
    icon: 'UserPlusIcon',
    classes: 'bg-sky-500/50 text-sky-100 backdrop-blur-md'
  },
  reply: {
    icon: 'ChatBubbleOvalLeftIcon',
    classes: 'bg-sky-500/50 text-sky-100 backdrop-blur-md'
  },
  mention: {
    icon: 'AtSymbolIcon',
    classes: 'bg-violet-500/50 text-violet-100 backdrop-blur-md'
  }
};

export function NotificationCard({
  notification
}: {
  notification: Notification;
}): JSX.Element {
  const { user: currentUser } = useAuth();

  const fromUserRef = notification.fromUserId
    ? doc(usersCollection, notification.fromUserId)
    : null;

  const { data: fromUser, loading: fromUserLoading } = useDocument(
    fromUserRef,
    {
      allowNull: true,
      disabled: !notification.fromUserId
    }
  );

  if (fromUserLoading) return <NotificationSkeleton />;

  const name = visibleProfileName(fromUser?.name);
  const username = visibleUsername(fromUser?.username);
  const href = notificationHref(notification, username ?? '');
  const context = resolveNotificationContext(notification);

  const markAsRead = async (): Promise<void> => {
    if (!currentUser) return;
    const ref = doc(notificationsCollection(currentUser.id), notification.id);
    await updateDoc(ref, { read: true });
  };

  const style = typeStyles[notification.type] ?? typeStyles.reply;
  const unread = !notification.read;

  return (
    <Link href={href}>
      <a
        className={cn(
          'hover-animation glass-card relative flex items-center gap-3.5 border-b border-light-border/60 px-4 py-3.5 hover:bg-light-primary/5 dark:border-dark-border/60 dark:hover:bg-dark-primary/5',
          unread && 'bg-main-accent/[0.07]'
        )}
        onClick={markAsRead}
      >
        <div className='relative shrink-0'>
          <UserAvatar
            src={fromUser?.photoURL ?? '/assets/default-avatar.png'}
            alt={name ?? ''}
            username={username ?? ''}
            size={46}
            showPresence={false}
          />
          <span
            className={cn(
              'absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full shadow-md ring-2 ring-main-background',
              style.classes
            )}
          >
            <HeroIcon className='h-3.5 w-3.5' iconName={style.icon} solid />
          </span>
        </div>

        <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <p className='text-[15px] text-light-primary dark:text-dark-primary'>
            {name ? (
              <span className='font-bold'>{name}</span>
            ) : (
              <Skeleton className='inline-block h-3.5 w-20 align-middle' />
            )}
            <span className='text-light-secondary dark:text-dark-secondary'>
              {' '}
              {notificationCopy(notification)}
            </span>
          </p>
          <div className='mt-0.5 flex flex-wrap items-center gap-2'>
            {context === 'reel' && (
              <span className='rounded-full bg-main-accent/15 px-2 py-0.5 text-[10px] font-bold text-main-accent-text'>
                ريلز
              </span>
            )}
            {context === 'story' && (
              <span className='rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300'>
                قصة
              </span>
            )}
            {notification.createdAt && (
              <p className='text-xs text-light-secondary/80 dark:text-dark-secondary/80'>
                {formatDate(notification.createdAt, 'tweet')}
              </p>
            )}
          </div>
        </div>

        {unread && (
          <span className='h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]' />
        )}
      </a>
    </Link>
  );
}
