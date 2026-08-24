import Link from 'next/link';
import cn from 'clsx';
import { HeroIcon } from '@components/ui/hero-icon';
import { VerifiedBadge } from '@components/ui/verified-badge';
import { StoryAvatar } from '@components/stories/story-avatar';
import { Skeleton } from '@components/ui/skeleton';
import { useLanguage } from '@lib/context/language-context';
import { getTimestampMillis, formatClockTime } from '@lib/date';
import { visibleProfileName, visibleUsername } from '@lib/utils';
import type { Conversation } from '@lib/types/message';
import type { User } from '@lib/types/user';

type ConversationCardProps = {
  conversation: Conversation;
  peer: User | null;
  currentUserId: string;
  active?: boolean;
};

function formatListTime(timestamp: unknown, locale: string, yesterdayLabel: string): string {
  const millis = getTimestampMillis(timestamp);
  if (!millis) return '';
  const date = new Date(millis);
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return new Intl.DateTimeFormat(locale, {
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
  const { t, locale } = useLanguage();
  const { id, lastMessage, unread } = conversation;
  const unreadCount = unread?.[currentUserId] ?? 0;
  const isOwnLast = lastMessage?.senderId === currentUserId;

  // نقطة النشاط الخضراء تُعرض من UserAvatar نفسها — لا نضيف نقطة ثانية هنا
  const typeIcon: string | null =
    lastMessage?.type === 'audio'
      ? 'MicrophoneIcon'
      : lastMessage?.type === 'image'
      ? 'PhotoIcon'
      : lastMessage?.type === 'video'
      ? 'VideoCameraIcon'
      : lastMessage?.type === 'shared'
      ? 'ArrowUpTrayIcon'
      : null;

  const previewText = lastMessage
    ? lastMessage.text ||
      (lastMessage.type === 'audio'
        ? t('messages.voice')
        : lastMessage.type === 'image'
        ? t('messages.image')
        : lastMessage.type === 'video'
        ? t('messages.video')
        : lastMessage.type === 'shared'
        ? t('messages.shared')
        : '')
    : t('messages.start');

  return (
    <Link href={`/messages/${id}`}>
      <a
        className={cn(
          'accent-tab hover-animation glass-card flex items-center gap-3 border-b border-light-border/60 px-4 py-3',
          'hover:bg-light-primary/5 dark:border-dark-border/60 dark:hover:bg-dark-primary/5',
          active && 'bg-light-primary/5 dark:bg-dark-primary/5'
        )}
      >
        <div className='relative shrink-0'>
          {peer ? (
            <StoryAvatar user={peer} size={48} />
          ) : (
            <Skeleton shape='circle' className='h-12 w-12' />
          )}
        </div>

        <div className='flex min-w-0 flex-1 flex-col'>
          <div className='flex items-center justify-between gap-2'>
            <div className='flex min-w-0 items-center gap-1'>
              {visibleProfileName(peer?.name) ? (
                <p
                  className={cn(
                    'truncate text-[15px]',
                    unreadCount > 0 && 'font-bold'
                  )}
                >
                  {visibleProfileName(peer?.name)}
                </p>
              ) : (
                <Skeleton className='h-3.5 w-24' />
              )}
              {peer?.verified && visibleProfileName(peer?.name) && (
                <VerifiedBadge className='h-4 w-4' />
              )}
              {visibleUsername(peer?.username) && (
                <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
                  @{visibleUsername(peer?.username)}
                </p>
              )}
            </div>
            {lastMessage && (
              <span className='shrink-0 text-xs text-light-secondary dark:text-dark-secondary'>
                {formatListTime(
                  lastMessage.createdAt,
                  locale,
                  t('common.yesterday')
                )}
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
              {isOwnLast && lastMessage && <span>{t('common.you')}: </span>}
              {typeIcon && (
                <HeroIcon className='h-4 w-4 shrink-0' iconName={typeIcon} />
              )}
              <span className='truncate'>{previewText}</span>
              {lastMessage?.edited && (
                <span className='shrink-0 text-[11px] opacity-75'>
                  · {t('common.edited')}
                </span>
              )}
            </p>
            {unreadCount > 0 && (
              <span
                className='flex h-5 min-w-[20px] shrink-0 items-center justify-center
                           rounded-full bg-main-accent px-1.5 text-xs font-bold text-main-accent-contrast'
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
