import Link from 'next/link';
import cn from 'clsx';
import { HeroIcon } from '@components/ui/hero-icon';
import { VerifiedBadge } from '@components/ui/verified-badge';
import { getTimestampMillis } from '@lib/date';
import type { Conversation } from '@lib/types/message';
import type { User } from '@lib/types/user';

type ConversationCardProps = {
  conversation: Conversation;
  peer: User | null;
  currentUserId: string;
  active?: boolean;
};

function formatListTime(timestamp: unknown): string {
  const millis = getTimestampMillis(timestamp);
  if (!millis) return '';
  const date = new Date(millis);
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return new Intl.DateTimeFormat('ar', {
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'أمس';
  return new Intl.DateTimeFormat('ar', {
    day: 'numeric',
    month: 'short'
  }).format(date);
}

export function ConversationCard({
  conversation,
  peer,
  currentUserId,
  active
}: ConversationCardProps): JSX.Element {
  const { id, lastMessage, unread } = conversation;
  const unreadCount = unread?.[currentUserId] ?? 0;
  const isOwnLast = lastMessage?.senderId === currentUserId;

  const typeIcon: string | null =
    lastMessage?.type === 'audio'
      ? 'MicrophoneIcon'
      : lastMessage?.type === 'image'
      ? 'PhotoIcon'
      : lastMessage?.type === 'video'
      ? 'VideoCameraIcon'
      : null;

  return (
    <Link href={`/messages/${id}`}>
      <a
        className={cn(
          'accent-tab hover-animation flex items-center gap-3 border-b border-light-border/60 px-4 py-3',
          'hover:bg-light-primary/5 dark:border-dark-border/60 dark:hover:bg-dark-primary/5',
          active && 'bg-light-primary/5 dark:bg-dark-primary/5'
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={peer?.photoURL || '/assets/default-avatar.png'}
          alt={peer?.name || 'مستخدم'}
          className='h-12 w-12 shrink-0 rounded-full object-cover'
        />

        <div className='flex min-w-0 flex-1 flex-col'>
          <div className='flex items-center justify-between gap-2'>
            <div className='flex min-w-0 items-center gap-1'>
              <p
                className={cn(
                  'truncate text-[15px]',
                  unreadCount > 0 && 'font-bold'
                )}
              >
                {peer?.name ?? 'مستخدم'}
              </p>
              {peer?.verified && <VerifiedBadge className='h-4 w-4' />}
              <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
                @{peer?.username ?? 'unknown'}
              </p>
            </div>
            {lastMessage && (
              <span className='shrink-0 text-xs text-light-secondary dark:text-dark-secondary'>
                {formatListTime(lastMessage.createdAt)}
              </span>
            )}
          </div>

          <div className='flex items-center justify-between gap-2'>
            <p
              className={cn(
                'trim-alt flex items-center gap-1 text-sm',
                unreadCount > 0
                  ? 'font-bold text-light-primary dark:text-dark-primary'
                  : 'text-light-secondary dark:text-dark-secondary'
              )}
            >
              {isOwnLast && lastMessage && <span>أنت: </span>}
              {typeIcon && (
                <HeroIcon className='h-4 w-4 shrink-0' iconName={typeIcon} />
              )}
              {lastMessage ? lastMessage.text : 'ابدأ المحادثة الآن'}
            </p>
            {unreadCount > 0 && (
              <span
                className='flex h-5 min-w-[20px] shrink-0 items-center justify-center
                           rounded-full bg-main-accent px-1.5 text-xs font-bold text-black'
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </a>
    </Link>
  );
}
