import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limitToLast
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import {
  conversationsCollection,
  conversationMessagesCollection,
  usersCollection
} from '@lib/firebase/collections';
import {
  sendMessage,
  markConversationRead,
  markMessageSeen
} from '@lib/messages';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { Loading } from '@components/ui/loading';
import { HeroIcon } from '@components/ui/hero-icon';
import { VerifiedBadge } from '@components/ui/verified-badge';
import { MessageBubble } from '@components/messages/message-bubble';
import { ChatComposer } from '@components/messages/chat-composer';
import type { ReactElement, ReactNode, Ref } from 'react';
import type { Conversation, Message } from '@lib/types/message';
import type { User } from '@lib/types/user';
import type { FilesWithId } from '@lib/types/file';

export default function Chat(): JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const conversationId = router.query.id as string | undefined;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [peer, setPeer] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [sending, setSending] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflow = useRef<string>('');

  // قفل الجسم وتتبع نافذة العرض المرئية حتى لا يُدفع الكيبورد الشريط العلوي
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const body = document.body;
    previousBodyOverflow.current = body.style.overflow;
    body.style.overflow = 'hidden';

    const visualViewport = window.visualViewport;
    const update = (): void => {
      const element = mainRef.current;
      if (!element || !visualViewport) return;
      // فقط على الشاشات الضيقة (أقل من xs) نثبّت الحاوية على النافذة المرئية
      if (window.innerWidth >= 520) {
        element.style.height = '';
        element.style.top = '';
        return;
      }
      element.style.height = `${visualViewport.height}px`;
      element.style.top = `${visualViewport.offsetTop}px`;
    };

    update();
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);
    return () => {
      body.style.overflow = previousBodyOverflow.current;
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  // الاستماع للمحادثة والتحقق من العضوية
  useEffect(() => {
    if (!user || !conversationId) return;

    const unsubscribe = onSnapshot(
      doc(conversationsCollection, conversationId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setForbidden(true);
          return;
        }
        const data = snapshot.data();
        if (!data.participants.includes(user.id)) {
          setForbidden(true);
          return;
        }
        setConversation(data);

        const peerId = data.participants.find(
          (participant) => participant !== user.id
        );
        if (peerId)
          void getDoc(doc(usersCollection, peerId)).then((peerSnapshot) => {
            if (peerSnapshot.exists()) setPeer(peerSnapshot.data());
          });
      },
      (error) => {
        console.error('chat conversation error:', error);
        setForbidden(true);
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversationId]);

  // الاستماع للرسائل
  useEffect(() => {
    if (!user || !conversationId || forbidden) return;

    const messagesQuery = query(
      conversationMessagesCollection(conversationId),
      orderBy('createdAt', 'asc'),
      limitToLast(150)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docSnapshot) =>
          docSnapshot.data({ serverTimestamps: 'estimate' })
        );
        setMessages(data);
        void markConversationRead(conversationId, user.id);

        // تحديث حالة القراءة لرسائل الطرف الآخر
        data
          .filter(
            (message) =>
              message.senderId !== user.id && !message.seenBy?.includes(user.id)
          )
          .forEach(
            (message) =>
              void markMessageSeen(
                conversationId,
                message.id,
                user.id,
                message.seenBy ?? []
              ).catch(() => undefined)
          );
      },
      (error) => {
        console.error('chat messages error:', error);
        setMessages([]);
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversationId, forbidden]);

  // التمرير لآخر رسالة
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages?.length]);

  const handleSend = async (
    payload:
      | { type: 'text'; text: string }
      | { type: 'image' | 'video'; files: FilesWithId }
      | { type: 'audio'; blob: Blob; duration: number; peaks: number[] }
  ): Promise<void> => {
    if (!conversation || !user) return;
    setSending(true);
    try {
      await sendMessage(conversation, user.id, payload);
    } catch {
      toast.error('تعذر إرسال الرسالة، حاول مرة أخرى');
    } finally {
      setSending(false);
    }
  };

  if (forbidden)
    return (
      <main className='mx-auto flex h-screen w-full max-w-xl flex-col items-center justify-center gap-4 border-x border-light-border text-center dark:border-dark-border'>
        <SEO title='الرسائل / Aite' />
        <HeroIcon className='h-12 w-12' iconName='EnvelopeIcon' />
        <p className='text-xl font-bold'>المحادثة غير متاحة</p>
        <Link href='/messages'>
          <a className='rounded-full bg-main-accent px-6 py-2 font-bold text-black'>
            العودة للرسائل
          </a>
        </Link>
      </main>
    );

  const peerName = peer?.name ?? 'محادثة';

  return (
    <main
      ref={mainRef as Ref<HTMLElement>}
      className='hover-animation fixed inset-x-0 top-0 z-40 mx-auto flex h-[100dvh]
                 w-full max-w-xl flex-col border-x-0 border-light-border
                 dark:border-dark-border xs:static xs:border-x'
    >
      <SEO title={`${peerName} / الرسائل / Aite`} />

      {/* الترويسة */}
      <header
        className='sticky top-0 z-30 flex items-center gap-3 border-b border-light-border/60
                   bg-main-background/85 px-3 py-2 backdrop-blur-md dark:border-dark-border/60'
      >
        <Link href='/messages'>
          <a
            aria-label='رجوع'
            className='dark-bg-tab rounded-full p-2 hover:bg-light-primary/10
                       dark:hover:bg-dark-primary/10'
          >
            <HeroIcon className='h-5 w-5' iconName='ChevronRightIcon' />
          </a>
        </Link>

        {peer && (
          <Link href={`/user/${peer.username}`}>
            <a className='flex min-w-0 items-center gap-3'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={peer.photoURL || '/assets/default-avatar.png'}
                alt={peer.name}
                className='h-9 w-9 rounded-full object-cover'
              />
              <span className='flex min-w-0 flex-col'>
                <span className='flex items-center gap-1'>
                  <span className='truncate font-bold'>{peer.name}</span>
                  {peer.verified && <VerifiedBadge className='h-4 w-4' />}
                </span>
                <span className='truncate text-xs text-light-secondary dark:text-dark-secondary'>
                  @{peer.username}
                </span>
              </span>
            </a>
          </Link>
        )}
      </header>

      {/* الرسائل */}
      <div
        ref={scrollRef}
        className='flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain bg-main-background px-3 py-4'
      >
        {!messages ? (
          <Loading className='mt-5' />
        ) : messages.length ? (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === user?.id}
            />
          ))
        ) : (
          <div className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
            {peer && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={peer.photoURL || '/assets/default-avatar.png'}
                  alt={peer.name}
                  className='h-16 w-16 rounded-full object-cover'
                />
                <p className='font-bold'>{peer.name}</p>
              </>
            )}
            <p className='text-sm text-light-secondary dark:text-dark-secondary'>
              ابدأ المحادثة بإرسال رسالة، صورة، فيديو أو تسجيل صوتي
            </p>
          </div>
        )}
      </div>

      {/* مربع الكتابة */}
      <div className='border-t border-light-border dark:border-dark-border'>
        {user && conversation && (
          <ChatComposer
            sending={sending}
            onSendText={(text) => void handleSend({ type: 'text', text })}
            onSendMedia={(files, kind) =>
              void handleSend({ type: kind, files })
            }
            onSendVoice={(blob, duration, peaks) =>
              void handleSend({ type: 'audio', blob, duration, peaks })
            }
          />
        )}
      </div>
    </main>
  );
}

Chat.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);
