import Link from 'next/link';
import { UserAvatar } from '@components/user/user-avatar';
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

  return (
    <Link href={`/messages/${conversation.id}`}>
      <a className='hover-animation flex items-start gap-3 border-b border-light-border 
                     px-4 py-3 dark:border-dark-border hover:bg-light-primary/5 
                     dark:hover:bg-dark-primary/5'>
        <UserAvatar
          src={other.photoURL}
          alt={other.name}
          username={other.username}
          size={48}
        />
        <div className='flex flex-1 flex-col'>
          <div className='flex items-center justify-between gap-2'>
            <UserName
              name={other.name}
              username={other.username}
              verified={!!other.verified}
              disableLink
            />
            {unread > 0 && (
              <span className='rounded-full bg-main-accent px-2 py-0.5 text-xs text-black'>
                {unread}
              </span>
            )}
          </div>
          <p className='mt-1 truncate text-sm text-light-secondary dark:text-dark-secondary'>
            {conversation.lastMessage ?? 'لا توجد رسائل'}
          </p>
        </div>
      </a>
    </Link>
  );
}
