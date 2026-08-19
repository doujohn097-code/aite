import Link from 'next/link';
import cn from 'clsx';
import { StoryAvatar } from '@components/stories/story-avatar';
import { UserName } from '@components/user/user-name';
import type { Conversation } from '@lib/types/message';

type ConversationCardProps = {
  conversation: Conversation;
  currentUserId: string;
};

export function ConversationCard({
  conversation,
  currentUserId
}: ConversationCardProps): JSX.Element {
  const participants = conversation.participants ?? [];
  const otherId =
    participants.find((id) => id !== currentUserId) ?? participants[0];
  const other = conversation.participantData?.[otherId ?? ''] ?? {
    name: 'مستخدم مجهول',
    username: 'unknown',
    photoURL: '/assets/default-avatar.png',
    verified: false
  };
  const unread = conversation.unreadCount?.[currentUserId] ?? 0;
  const hasUnread = unread > 0;

  return (
    <Link href={`/messages/${conversation.id}`}>
      <a
        className={cn(
          'hover-animation relative flex items-start gap-3 border-b border-light-border px-4 py-3 dark:border-dark-border hover:bg-light-primary/5 dark:hover:bg-dark-primary/5',
          hasUnread && 'bg-main-accent/[0.06]'
        )}
      >
        <StoryAvatar
          user={{ id: otherId, name: other.name, username: other.username, photoURL: other.photoURL }}
          size={48}
        />
        <div className='flex min-w-0 flex-1 flex-col'>
          <div className='flex items-center justify-between gap-2'>
            <UserName
              name={other.name}
              username={other.username}
              verified={!!other.verified}
              disableLink
            />
            {hasUnread && (
              <span className='flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white shadow-sm'>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
          <p
            className={cn(
              'mt-1 truncate text-sm text-light-secondary dark:text-dark-secondary',
              hasUnread && 'font-semibold text-light-primary dark:text-dark-primary'
            )}
          >
            {conversation.lastMessage ?? 'لا توجد رسائل'}
          </p>
        </div>
      </a>
    </Link>
  );
}
