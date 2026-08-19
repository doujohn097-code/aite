import Link from 'next/link';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { useDocument } from '@lib/hooks/useDocument';
import { usersCollection, notificationsCollection } from '@lib/firebase/collections';
import { formatDate } from '@lib/date';
import { UserAvatar } from '@components/user/user-avatar';
import { HeroIcon } from '@components/ui/hero-icon';
import type { Notification } from '@lib/types/notification';

const notificationText: Record<
  Notification['type'],
  (name: string) => string
> = {
  like: (name) => `${name} أعجب بمنشورك`,
  retweet: (name) => `${name} أعاد نشر منشورك`,
  follow: (name) => `${name} بدأ بمتابعتك`,
  reply: (name) => `${name} رد على منشورك`,
  message: (name) => `${name} أرسل لك رسالة`,
  storyLike: (name) => `${name} أعجب بقصتك`
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

  return (
    <Link href={href}>
      <a
        className={`hover-animation flex items-start gap-3 border-b border-light-border
                    px-4 py-3 hover:bg-light-primary/5 dark:border-dark-border 
                    dark:hover:bg-dark-primary/5 ${!notification.read ? 'bg-main-accent/5' : ''}`}
        onClick={markAsRead}
      >
        <HeroIcon
          className='h-6 w-6 text-main-accent'
          iconName={
            notification.type === 'like' || notification.type === 'storyLike'
              ? 'HeartIcon'
              : notification.type === 'retweet'
              ? 'ArrowPathRoundedSquareIcon'
              : notification.type === 'follow'
              ? 'UserPlusIcon'
              : notification.type === 'message'
              ? 'EnvelopeIcon'
              : 'ChatBubbleOvalLeftIcon'
          }
        />
        <div className='flex flex-1 flex-col gap-1'>
          <UserAvatar
            src={fromUser?.photoURL ?? '/assets/default-avatar.png'}
            alt={name}
            username={username}
            size={40}
          />
          <p className='text-light-primary dark:text-dark-primary'>
            <span className='font-bold'>{name}</span>{' '}
            {notificationText[notification.type](name)}
          </p>
          {notification.messageText && (
            <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
              {notification.messageText}
            </p>
          )}
          {notification.createdAt && (
            <p className='text-sm text-light-secondary dark:text-dark-secondary'>
              {formatDate(notification.createdAt, 'tweet')}
            </p>
          )}
        </div>
      </a>
    </Link>
  );
}
