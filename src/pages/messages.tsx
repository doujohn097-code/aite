import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import {
  conversationsCollection,
  usersCollection
} from '@lib/firebase/collections';
import { getOrCreateConversation } from '@lib/messages';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { SEO } from '@components/common/seo';
import { ConversationFeedSkeleton } from '@components/ui/skeleton';
import { HeroIcon } from '@components/ui/hero-icon';
import { Modal } from '@components/modal/modal';
import { useModal } from '@lib/hooks/useModal';
import { ConversationCard } from '@components/messages/conversation-card';
import { NewMessageModal } from '@components/messages/new-message-modal';
import { StoriesBar } from '@components/stories/stories-bar';
import type { ReactElement, ReactNode } from 'react';
import type { Conversation } from '@lib/types/message';
import { blankUser } from '@lib/firebase/users';
import type { User } from '@lib/types/user';

export default function Messages(): JSX.Element {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { open, openModal, closeModal } = useModal();

  const [conversations, setConversations] = useState<Conversation[] | null>(
    null
  );
  const [peers, setPeers] = useState<Record<string, User>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;

    const conversationsQuery = query(
      conversationsCollection,
      where('participants', 'array-contains', user.id)
    );

    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docSnapshot) =>
          docSnapshot.data({ serverTimestamps: 'estimate' })
        );

        data.sort(
          (a, b) =>
            (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
        );
        setConversations(data);

        const peerIds = data
          .map((conversation) =>
            conversation.participants.find(
              (participant) => participant !== user.id
            )
          )
          .filter((id): id is string => !!id);

        void Promise.all(
          peerIds.map((id) => getDoc(doc(usersCollection, id)))
        ).then((docs) => {
          const fetched: Record<string, User> = {};
          docs.forEach((snapshot, index) => {
            fetched[snapshot.id || peerIds[index]] = snapshot.exists()
              ? snapshot.data()
              : blankUser(peerIds[index]);
          });
          setPeers((previous) => ({ ...previous, ...fetched }));
        });
      },
      (error) => {
        console.error('conversations snapshot error:', error);
        setConversations([]);
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    if (!conversations) return null;
    const visible = conversations.filter((conversation) => {
      const peerId = conversation.participants.find(
        (participant) => participant !== user?.id
      );
      return !peerId || !user?.blockedUsers?.includes(peerId);
    });
    const term = search.trim().toLowerCase();
    if (!term) return visible;
    return visible.filter((conversation) => {
      const peerId = conversation.participants.find(
        (participant) => participant !== user?.id
      );
      const peer = peerId ? peers[peerId] : null;
      return (
        peer?.name.toLowerCase().includes(term) ||
        peer?.username.toLowerCase().includes(term)
      );
    });
  }, [conversations, peers, search, user]);

  const startConversation = async (target: User): Promise<void> => {
    if (!user) return;
    const conversation = await getOrCreateConversation(user.id, target.id);
    closeModal();
    void router.push(`/messages/${conversation.id}`);
  };

  return (
    <MainContainer>
      <SEO title={t('messages.title')} />
      <MainHeader title={t('messages.heading')}>
        <button
          type='button'
          onClick={openModal}
          aria-label={t('messages.new')}
          className='dark-bg-tab group relative rounded-full p-2 hover:bg-light-primary/10
                     active:bg-light-primary/20 dark:hover:bg-dark-primary/10
                     dark:active:bg-dark-primary/20'
        >
          <HeroIcon className='h-5 w-5' iconName='PencilSquareIcon' />
        </button>
      </MainHeader>

      <Modal
        open={open}
        closeModal={closeModal}
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl w-full max-w-md mt-8 overflow-hidden'
      >
        <NewMessageModal closeModal={closeModal} onSelect={startConversation} />
      </Modal>

      <StoriesBar />

      {conversations && conversations.length > 0 && (
        <div className='px-4 py-3'>
          <div className='flex items-center gap-2 rounded-full bg-main-search-background px-4 py-2.5'>
            <HeroIcon
              className='h-4 w-4 text-light-secondary dark:text-dark-secondary'
              iconName='MagnifyingGlassIcon'
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('messages.search')}
              className='w-full bg-transparent text-sm outline-none
                         placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
            />
          </div>
        </div>
      )}

      {!conversations ? (
        <ConversationFeedSkeleton />
      ) : !filtered?.length && conversations.length ? (
        <p className='p-12 text-center text-light-secondary dark:text-dark-secondary'>
          {t('messages.noMatch')}
        </p>
      ) : conversations.length ? (
        <section className='overflow-x-clip'>
          {filtered?.map((conversation) => {
            const peerId = conversation.participants.find(
              (participant) => participant !== user?.id
            );
            const peer = peerId ? peers[peerId] ?? null : null;
            const isActive =
              router.asPath.split('?')[0] === `/messages/${conversation.id}`;

            return (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                peer={peer}
                currentUserId={user?.id ?? ''}
                active={isActive}
              />
            );
          })}
        </section>
      ) : (
        <div className='flex flex-col items-center gap-4 p-12 text-center'>
          <div className='flex h-20 w-20 items-center justify-center rounded-full bg-main-accent/10 text-main-accent-text'>
            <HeroIcon className='h-10 w-10' iconName='EnvelopeIcon' />
          </div>
          <p className='text-2xl font-bold'>{t('messages.empty')}</p>
          <p className='max-w-xs text-light-secondary dark:text-dark-secondary'>
            {t('messages.emptyHint')}
          </p>
          <button
            type='button'
            onClick={openModal}
            className='rounded-full bg-main-accent px-6 py-2.5 font-bold text-main-accent-contrast
                       transition hover:brightness-90 active:brightness-75'
          >
            {t('messages.new')}
          </button>
        </div>
      )}
    </MainContainer>
  );
}

Messages.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);
