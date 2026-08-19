import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import {
  conversationsCollection,
  messagesCollection,
  usersCollection
} from '@lib/firebase/collections';
import { useDocument } from '@lib/hooks/useDocument';
import { useCollection } from '@lib/hooks/useCollection';
import { getOrCreateConversation } from '@lib/firebase/utils';
import { getTimestampMillis } from '@lib/date';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { SEO } from '@components/common/seo';
import { Loading } from '@components/ui/loading';
import { HeroIcon } from '@components/ui/hero-icon';
import { ConversationCard } from '@components/messages/conversation-card';
import { MessageList } from '@components/messages/message-list';
import { MessageInput } from '@components/messages/message-input';
import { StoryAvatar } from '@components/stories/story-avatar';
import { UserName } from '@components/user/user-name';
import { UserAvatar } from '@components/user/user-avatar';
import type { ReactElement, ReactNode } from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import type { WithFieldValue } from 'firebase/firestore';
import type { Conversation, Message, ReplyTo } from '@lib/types/message';
import type { User } from '@lib/types/user';

export default function Messages(): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();

  const conversationId = (router.query.id as string[] | undefined)?.[0];

  return conversationId ? (
    <ConversationRoom conversationId={conversationId} userId={user?.id} />
  ) : (
    <ConversationsList userId={user?.id} />
  );
}

Messages.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);

export const getStaticPaths: GetStaticPaths = async () => {
  await Promise.resolve();
  return {
    paths: [{ params: { id: [] } }],
    fallback: 'blocking'
  };
};

export const getStaticProps: GetStaticProps = async () => {
  await Promise.resolve();
  return { props: {} };
};

/* ================================================================== */
/* Conversations list                                                  */
/* ================================================================== */

function ConversationsList({ userId }: { userId?: string }): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [starting, setStarting] = useState(false);

  const conversationsQuery = useMemo(
    () =>
      userId
        ? query(
            conversationsCollection,
            where('participants', 'array-contains', userId)
          )
        : null,
    [userId]
  );

  const { data: conversations, loading } = useCollection(conversationsQuery, {
    allowNull: true,
    disabled: !userId
  });

  const sorted = useMemo(() => {
    if (!conversations) return null;
    return [...conversations].sort(
      (a: Conversation, b: Conversation) =>
        getTimestampMillis(b.lastMessageAt) - getTimestampMillis(a.lastMessageAt)
    );
  }, [conversations]);

  // People you follow — candidates for a new chat
  const followingQuery = useMemo(
    () =>
      user?.following?.length
        ? query(
            usersCollection,
            where('username', '>=', search || '~'),
            where('username', '<=', `${search || '~'}\uf8ff`)
          )
        : null,
    [search, user?.following]
  );

  const { data: candidates } = useCollection(followingQuery, {
    allowNull: true,
    disabled: !search
  });

  const startChat = async (target: User): Promise<void> => {
    if (!userId || starting) return;
    setStarting(true);
    try {
      const id = await getOrCreateConversation(userId, target);
      setSearch('');
      await router.push(`/messages/${id}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <MainContainer className='h-full min-h-0 overflow-hidden'>
      <SEO title='الرسائل / Aite' />
      <MainHeader title='الرسائل' useMobileSidebar />

      {/* New chat search */}
      <div className='border-b border-light-line-reply px-3 py-2.5 dark:border-dark-line-reply'>
        <div className='flex items-center gap-2 rounded-full bg-light-search-background px-4 py-2 dark:bg-dark-search-background'>
          <HeroIcon className='h-5 w-5 text-light-secondary dark:text-dark-secondary' iconName='MagnifyingGlassIcon' />
          <input
            value={search}
            onChange={(e): void => setSearch(e.target.value)}
            placeholder='ابحث عن مستخدم لبدء محادثة...'
            className='w-full bg-transparent text-sm text-light-primary outline-none placeholder:text-light-secondary
                       dark:text-dark-primary dark:placeholder:text-dark-secondary'
          />
        </div>
        {search && candidates && (
          <div className='mt-1 flex flex-col gap-1'>
            {candidates
              .filter((u) => u.id !== userId)
              .slice(0, 6)
              .map((candidate: User) => (
                <button
                  key={candidate.id}
                  type='button'
                  onClick={(): void => void startChat(candidate)}
                  className='hover-animation flex items-center gap-3 rounded-xl px-3 py-2 text-right hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                >
                  <UserAvatar
                    src={candidate.photoURL}
                    alt={candidate.name}
                    username={undefined}
                    size={40}
                  />
                  <span className='flex flex-col'>
                    <span className='text-sm font-bold text-light-primary dark:text-dark-primary'>
                      {candidate.name}
                    </span>
                    <span className='text-xs text-light-secondary dark:text-dark-secondary'>
                      @{candidate.username}
                    </span>
                  </span>
                  {starting && <Loading iconClassName='mr-auto h-4 w-4' />}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Conversations */}
      {loading ? (
        <Loading className='mt-5' />
      ) : !sorted?.length ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center'>
          <HeroIcon
            className='h-16 w-16 text-light-secondary dark:text-dark-secondary'
            iconName='EnvelopeIcon'
          />
          <p className='text-2xl font-bold'>ابدأ محادثة جديدة</p>
          <p className='max-w-xs text-light-secondary dark:text-dark-secondary'>
            ابحث عن مستخدم بالأعلى وابدأ الدردشة معه.
          </p>
        </div>
      ) : (
        <section className='flex flex-col'>
          {sorted.map((conversation: Conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              currentUserId={userId ?? ''}
            />
          ))}
        </section>
      )}
    </MainContainer>
  );
}

/* ================================================================== */
/* Single conversation room                                            */
/* ================================================================== */

function ConversationRoom({
  conversationId,
  userId
}: {
  conversationId: string;
  userId?: string;
}): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

  const conversationRef = doc(conversationsCollection, conversationId);
  const { data: conversation, loading: conversationLoading } =
    useDocument(conversationRef, { allowNull: true });

  const {
    data: messages,
    loading: messagesLoading
  } = useCollection(query(messagesCollection(conversationId), orderBy('createdAt', 'asc')), {
    allowNull: true
  });

  // Mark as read when opening and whenever new messages arrive while here
  useEffect(() => {
    if (!userId) return;
    void updateDoc(
      conversationRef,
      {
        [`unreadCount.${userId}`]: 0
      } as Partial<WithFieldValue<Conversation>>
    ).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conversationId, messages?.length]);

  const otherId = conversation?.participants?.find((p) => p !== userId) ?? '';
  const other = conversation?.participantData?.[otherId] ?? null;

  return (
    <MainContainer className='h-full min-h-0 overflow-hidden'>
      <SEO title={`المحادثة / Aite`} />
      <div
        className='sticky top-0 z-10 flex items-center gap-3 border-b border-light-line-reply
                   bg-main-background px-3 py-2.5 dark:border-dark-line-reply'
      >
        <button
          type='button'
          onClick={(): void => void router.back()}
          className='-ml-1 rounded-full p-1.5 transition hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
        >
          <HeroIcon className='h-5 w-5' iconName='ArrowLeftIcon' />
        </button>
        {other && (
          <>
            <StoryAvatar user={{ id: otherId, name: other.name, username: other.username, photoURL: other.photoURL }} size={44} />
            <div className='flex flex-col'>
              <UserName
                name={other.name}
                username={other.username}
                verified={!!other.verified}
              />

            </div>
          </>
        )}
      </div>

      {conversationLoading || messagesLoading ? (
        <Loading className='mt-5' />
      ) : (
        <MessageList
          messages={(messages ?? []) as Message[]}
          currentUserId={userId ?? ''}
          participantData={other as { photoURL: string; name: string } | null}
          conversationId={conversationId}
          onReply={(message: Message): void =>
            setReplyTo({
              id: message.id,
              text: message.text,
              senderId: message.senderId
            })
          }
        />
      )}

      <MessageInput
        conversationId={conversationId}
        receiverId={otherId}
        replyTo={replyTo}
        onClearReply={(): void => setReplyTo(null)}
      />
    </MainContainer>
  );
}
