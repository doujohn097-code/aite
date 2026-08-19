import Link from 'next/link';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { useDocument } from '@lib/hooks/useDocument';
import { usersCollection, notificationsCollection } from '@lib/firebase/collections';
import { formatDate } from '@lib/date';
import { UserAvatar } from '@components/user/user-avatar';
import { HeroIcon } from '@components/ui/hero-icon';
import cn from 'clsx';
import type { Notification } from '@lib/types/notification';
import type { IconName } from '@components/ui/hero-icon';

const notificationText: Record<
  Notification['type'],
  (name: string) => string
> = {
  like: () => 'أعجب بمنشورك',
  retweet: () => 'أعاد نشر منشورك',
  follow: () => 'بدأ بمتابعتك',
  reply: () => 'رد على منشورك',
  message: () => 'أرسل لك رسالة',
  storyLike: () => 'أعجب بقصتك'
};

const typeStyles: Record<
  Notification['type'],
  { icon: IconName; classes: string }
> = {
  like: { icon: 'HeartIcon', classes: 'bg-rose-500/15 text-rose-500' },
  storyLike: { icon: 'HeartIcon', classes: 'bg-rose-500/15 text-rose-500' },
  retweet: { icon: 'ArrowPathRoundedSquareIcon', classes: 'bg-emerald-500/15 text-emerald-500' },
  follow: { icon: 'UserPlusIcon', classes: 'bg-sky-500/15 text-sky-400' },
  reply: { icon: 'ChatBubbleOvalLeftIcon', classes: 'bg-sky-500/15 text-sky-400' },
  message: { icon: 'EnvelopeIcon', classes: 'bg-indigo-500/15 text-indigo-400' }
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

  const { data: fromUser } = useDocument(fromUserRef, {
    allowNull: true,
    disabled: !notification.fromUserId
  });

  const name = fromUser?.name ?? 'مستخدم';
  const username = fromUser?.username ?? 'unknown';

  const href =
    notification.type === 'message'
      ? `/messages/${[notification.fromUserId, currentUser?.id ?? '']
          .sort()
          .join('_')}`
      : notification.type === 'follow'
      ? `/user/${username}`
      : notification.type === 'storyLike' && notification.storyUserId
      ? `/stories/${notification.storyUserId}?storyId=${notification.storyId ?? ''}`
      : notification.tweetId
      ? `/tweet/${notification.tweetId}`
      : '/home';

  const markAsRead = async (): Promise<void> => {
    if (!currentUser) return;
    const ref = doc(
      notificationsCollection(currentUser.id),
      notification.id
    );
    await updateDoc(ref, { read: true });
  };

  const style = typeStyles[notification.type] ?? typeStyles.reply;
  const unread = !notification.read;

  return (
    <Link href={href}>
      <a
        className={cn(
          'hover-animation relative flex items-center gap-3.5 border-b border-light-border/60 px-4 py-3.5 hover:bg-light-primary/5 dark:border-dark-border/60 dark:hover:bg-dark-primary/5',
          unread && 'bg-main-accent/[0.07]'
        )}
        onClick={markAsRead}
      >
        {/* Avatar with type badge */}
        <div className='relative shrink-0'>
          <UserAvatar
            src={fromUser?.photoURL ?? '/assets/default-avatar.png'}
            alt={name}
            username={username}
            size={46}
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

        {/* Text */}
        <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <p className='text-[15px] text-light-primary dark:text-dark-primary'>
            <span className='font-bold'>{name}</span>
            <span className='text-light-secondary dark:text-dark-secondary'>
              {' '}
              {notificationText[notification.type](name)}
            </span>
          </p>
          {notification.messageText && (
            <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
              {notification.messageText}
            </p>
          )}
          {notification.createdAt && (
            <p className='mt-0.5 text-xs text-light-secondary/80 dark:text-dark-secondary/80'>
              {formatDate(notification.createdAt, 'tweet')}
            </p>
          )}
        </div>

        {/* Unread indicator */}
        {unread && (
          <span className='h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]' />
        )}
      </a>
    </Link>
  );
}
