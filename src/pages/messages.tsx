import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { collectionsFor } from '@lib/firebase/collections';
import { fetchUserAnywhere } from '@lib/dual';
import { getOrCreateConversation } from '@lib/messages';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { SEO } from '@components/common/seo';
import { Loading } from '@components/ui/loading';
import { HeroIcon } from '@components/ui/hero-icon';
import { Modal } from '@components/modal/modal';
import { useModal } from '@lib/hooks/useModal';
import { ConversationCard } from '@components/messages/conversation-card';
import { NewMessageModal } from '@components/messages/new-message-modal';
import { StoriesBar } from '@components/stories/stories-bar';
import type { ReactElement, ReactNode } from 'react';
import type { Conversation } from '@lib/types/message';
import type { User } from '@lib/types/user';

export default function Messages(): JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const { open, openModal, closeModal } = useModal();

  const [conversations, setConversations] = useState<Conversation[] | null>(
    null
  );
  const [peers, setPeers] = useState<Record<string, User>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;

    // Conversations may live in either round-robin database — subscribe to
    // both and merge.
    const conversationsQueryA = query(
      collectionsFor('a').conversations,
      where('participants', 'array-contains', user.id)
    );
    const conversationsQueryB = query(
      collectionsFor('b').conversations,
      where('participants', 'array-contains', user.id)
    );

    const byId = new Map<string, Conversation>();
    let loadedA = false;
    let loadedB = false;
    let anyDataArrived = false;
    let disposed = false;

    const publish = (): void => {
      if (disposed) return;
      const data = Array.from(byId.values()).sort(
        (a, b) =>
          (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
      );
      setConversations(data);
      if (data.length) anyDataArrived = true;

      const peerIds = data
        .map((conversation) =>
          conversation.participants.find(
            (participant) => participant !== user.id
          )
        )
        .filter((id): id is string => !!id);

      if (!peerIds.length) return;
      void Promise.all(
        peerIds.map((id) =>
          Promise.race([
            fetchUserAnywhere(id),
            new Promise<User | null>((resolve) =>
              setTimeout(() => resolve(null), 4000)
            )
          ])
        )
      ).then((users) => {
        if (disposed) return;
        const fetched: Record<string, User> = {};
        users.forEach((u) => {
          if (u) fetched[u.id] = u;
        });
        setPeers((previous) => ({ ...previous, ...fetched }));
      });
    };

    const onSnapshotWrapper =
      (loadedKey: 'loadedA' | 'loadedB') =>
      (snapshot: {
        docs: { id: string; data: () => Conversation }[];
      }): void => {
        snapshot.docs.forEach((docSnapshot) => {
          byId.set(docSnapshot.id, docSnapshot.data());
        });
        if (loadedKey === 'loadedA') loadedA = true;
        else loadedB = true;
        // Publish as soon as EITHER project answers — never wait for both.
        publish();
      };

    const unsubscribeA = onSnapshot(
      conversationsQueryA,
      onSnapshotWrapper('loadedA'),
      () => {
        loadedA = true;
        publish();
      }
    );
    const unsubscribeB = onSnapshot(
      conversationsQueryB,
      onSnapshotWrapper('loadedB'),
      () => {
        loadedB = true;
        publish();
      }
    );

    // Safety net: never leave the conversation list hanging because a
    // project's channel is blocked.
    const safety = setTimeout(() => {
      if (!disposed && !anyDataArrived) publish();
    }, 6000);

    return () => {
      disposed = true;
      clearTimeout(safety);
      unsubscribeA();
      unsubscribeB();
    };
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
      <SEO title='الرسائل / Aite' />
      <MainHeader title='الرسائل'>
        <button
          type='button'
          onClick={openModal}
          aria-label='رسالة جديدة'
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
              placeholder='ابحث في المحادثات'
              className='w-full bg-transparent text-sm outline-none
                         placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
            />
          </div>
        </div>
      )}

      {!conversations ? (
        <Loading className='mt-5' />
      ) : !filtered?.length && conversations.length ? (
        <p className='p-12 text-center text-light-secondary dark:text-dark-secondary'>
          لا توجد نتائج مطابقة
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
          <div className='flex h-20 w-20 items-center justify-center rounded-full bg-main-accent/10 text-main-accent'>
            <HeroIcon className='h-10 w-10' iconName='EnvelopeIcon' />
          </div>
          <p className='text-2xl font-bold'>لا توجد محادثات بعد</p>
          <p className='max-w-xs text-light-secondary dark:text-dark-secondary'>
            ابدأ محادثة جديدة مع الأشخاص الذين تتابعهم وستظهر هنا.
          </p>
          <button
            type='button'
            onClick={openModal}
            className='rounded-full bg-main-accent px-6 py-2.5 font-bold text-black
                       transition hover:brightness-90 active:brightness-75'
          >
            رسالة جديدة
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
