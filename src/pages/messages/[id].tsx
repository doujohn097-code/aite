import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { doc, onSnapshot, query, where } from 'firebase/firestore';
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
  markMessageSeen,
  toggleMessageReaction,
  setTyping,
  deleteMessage
} from '@lib/messages';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { Loading } from '@components/ui/loading';
import { HeroIcon } from '@components/ui/hero-icon';
import { VerifiedBadge } from '@components/ui/verified-badge';
import { MessageBubble } from '@components/messages/message-bubble';
import { TypingIndicator } from '@components/messages/typing-indicator';
import { ChatComposer } from '@components/messages/chat-composer';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { StoryAvatar } from '@components/stories/story-avatar';
import { getTimestampMillis } from '@lib/date';
import type { ReactElement, ReactNode, Ref } from 'react';
import type { Conversation, Message } from '@lib/types/message';
import type { User } from '@lib/types/user';
import type { FilesWithId } from '@lib/types/file';

function dayKey(millis: number): string {
  return new Date(millis).toDateString();
}

function formatDayLabel(millis: number): string {
  const d = new Date(millis);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'اليوم';
  if (d.toDateString() === yesterday.toDateString()) return 'أمس';
  return new Intl.DateTimeFormat('ar', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(d);
}

export default function Chat(): JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const conversationId = router.query.id as string | undefined;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [peer, setPeer] = useState<User | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [sending, setSending] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  // معرّف أول رسالة غير مقروءة من الطرف الآخر — لعرض فاصل "رسائل جديدة"
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  // الرسالة قيد الرد عليها عبر السحب
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
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

  // مكوّن الصفحة يعاد استخدامه عند تبديل المحادثة — نعيد التهيئة لكل معرّف
  useEffect(() => {
    setForbidden(false);
    setConversation(null);
    setMessages(null);
    setReplyTarget(null);
    setFirstUnreadId(null);
    setShowJumpToLatest(false);
    stickToBottomRef.current = true;
  }, [conversationId]);

  // إيقاف "يكتب الآن" عند مغادرة المحادثة
  useEffect(() => {
    if (!conversationId || !user) return;
    return () => {
      void setTyping(conversationId, null).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

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
        const otherId = data.participants.find(
          (participant) => participant !== user.id
        );
        if (otherId && user.blockedUsers?.includes(otherId)) {
          setForbidden(true);
          return;
        }
        setForbidden(false);
        setConversation(data);
        setPeerId(otherId ?? null);
      },
      (error) => {
        console.error('chat conversation error:', error);
        setForbidden(true);
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversationId]);

  // الاستماع الحي لبيانات الطرف الآخر (النشاط، الصورة، القصة)
  useEffect(() => {
    if (!peerId) return;
    const unsubscribe = onSnapshot(
      doc(usersCollection, peerId),
      (snapshot) => {
        if (snapshot.exists()) setPeer(snapshot.data());
      },
      () => undefined
    );
    return unsubscribe;
  }, [peerId]);

  const peerTyping = conversation?.typing === peerId;
  const peerActiveMillis = peer?.lastActiveAt
    ? getTimestampMillis(peer.lastActiveAt)
    : null;
  const peerOnline =
    !!peerActiveMillis && Date.now() - peerActiveMillis < 3 * 60 * 1000;

  // الاستماع للرسائل
  useEffect(() => {
    if (!user || !conversationId || forbidden) return;

    // فلتر واحد فقط بلا orderBy — array-contains مع orderBy يتطلب فهرسًا مركّبًا
    // غير موجود فيفشل الاستعلام وتختفي الرسائل. نرتّب محليًا ونقتطع آخر 150.
    const messagesQuery = query(
      conversationMessagesCollection(conversationId),
      where('participants', 'array-contains', user.id)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const data = snapshot.docs
          .map((docSnapshot) =>
            docSnapshot.data({ serverTimestamps: 'estimate' })
          )
          .sort(
            (a, b) =>
              (a.createdAt?.toMillis?.() ?? 0) -
              (b.createdAt?.toMillis?.() ?? 0)
          )
          .slice(-150);
        setMessages((prev) => {
          if (prev === null) {
            const firstUnread = data.find(
              (m) => m.senderId !== user.id && !m.seenBy?.includes(user.id)
            );
            if (firstUnread) setFirstUnreadId(firstUnread.id);
          }
          return data;
        });
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

  // لا نسحب المستخدم إلى الأسفل بينما يقرأ رسائل أقدم. نلتصق بالنهاية فقط
  // عندما يكون هناك أصلًا، أو عند إرسال رسالة منه.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !stickToBottomRef.current) return;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [messages?.length, peerTyping]);

  const handleMessageScroll = (): void => {
    const element = scrollRef.current;
    if (!element) return;
    stickToBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    setShowJumpToLatest(!stickToBottomRef.current);
  };

  const jumpToLatest = (): void => {
    const element = scrollRef.current;
    if (!element) return;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  };

  const toMillis = (value: Message['createdAt']): number =>
    typeof value?.toMillis === 'function'
      ? value.toMillis()
      : (value as unknown as { seconds?: number })?.seconds
      ? (value as unknown as { seconds: number }).seconds * 1000
      : Date.now();

  // لا نعرض الرسالة قبل أن تقبلها Firestore؛ هذا يمنع ظهور رسالة لم تُرسل فعليًا.
  const shownMessages = useMemo(
    () => [...(messages ?? [])].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)),
    [messages]
  );

  const handleSend = async (
    payload:
      | { type: 'text'; text: string }
      | { type: 'image' | 'video'; files: FilesWithId }
      | { type: 'audio'; blob: Blob; duration: number; peaks: number[] }
  ): Promise<void> => {
    if (!conversation || !user) return;

    const replyTo = replyTarget
      ? {
          id: replyTarget.id,
          senderId: replyTarget.senderId,
          senderName:
            replyTarget.senderId === user.id ? user.name : peer?.name ?? null,
          text: replyTarget.text,
          type: replyTarget.type
        }
      : null;

    setReplyTarget(null);
    setSending(true);
    try {
      await sendMessage(conversation, user.id, { ...payload, replyTo });
      void setTyping(conversation.id, null).catch(() => undefined);
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
      <Modal
        open={!!deleteTarget}
        closeModal={() => setDeleteTarget(null)}
        modalClassName='w-full max-w-sm rounded-3xl border border-light-border bg-main-background p-6 shadow-2xl dark:border-dark-border'
      >
        <ActionModal
          title='حذف الرسالة؟'
          description='ستُحذف الرسالة للطرفين وتظهر مكانها ملاحظة الحذف.'
          mainBtnLabel='حذف الرسالة'
          mainBtnClassName='bg-accent-red hover:bg-accent-red/90'
          action={async () => {
            if (!conversationId || !deleteTarget) return;
            await deleteMessage(conversationId, deleteTarget.id);
            setDeleteTarget(null);
            toast.success('تم حذف الرسالة');
          }}
          closeModal={() => setDeleteTarget(null)}
        />
      </Modal>

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
              <span className='relative shrink-0'>
                <StoryAvatar user={peer} size={40} />
              </span>
              <span className='flex min-w-0 flex-col'>
                <span className='flex items-center gap-1'>
                  <span className='truncate font-bold'>{peer.name}</span>
                  {peer.verified && <VerifiedBadge className='h-4 w-4' />}
                </span>
                <span
                  className={
                    peerOnline
                      ? 'truncate text-xs font-semibold text-green-500'
                      : 'truncate text-xs text-light-secondary dark:text-dark-secondary'
                  }
                >
                  {peerOnline ? 'نشط الآن' : `@${peer.username}`}
                </span>
              </span>
            </a>
          </Link>
        )}
      </header>

      {/* الرسائل */}
      <div
        ref={scrollRef}
        onScroll={handleMessageScroll}
        className='relative flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-clip overscroll-contain bg-main-background px-3 py-4'
      >
        {!messages ? (
          <Loading className='mt-5' />
        ) : shownMessages.length ? (
          shownMessages.map((message, index) => {
            const millis = toMillis(message.createdAt);
            const prev = index > 0 ? shownMessages[index - 1] : null;
            const prevMillis = prev ? toMillis(prev.createdAt) : 0;
            const showDate = !prev || dayKey(millis) !== dayKey(prevMillis);
            return (
              <div key={message.id} className='contents'>
                {showDate && (
                  <div
                    className='sticky top-2 z-10 mx-auto my-2 w-fit rounded-full
                               bg-main-background/90 px-3 py-1 text-[11px] font-semibold
                               text-light-secondary shadow-sm backdrop-blur-md
                               dark:text-dark-secondary'
                  >
                    {formatDayLabel(millis)}
                  </div>
                )}
                {message.id === firstUnreadId && (
                  <div className='my-3 flex items-center gap-2'>
                    <span className='h-px flex-1 bg-main-accent/40' />
                    <span
                      className='rounded-full bg-main-accent/15 px-3 py-0.5 text-[11px]
                                 font-bold text-main-accent'
                    >
                      رسائل جديدة
                    </span>
                    <span className='h-px flex-1 bg-main-accent/40' />
                  </div>
                )}
                <MessageBubble
                  message={message}
                  isOwn={message.senderId === user?.id}
                  viewerId={user?.id}
                  onReply={setReplyTarget}
                  onDelete={(target) => setDeleteTarget(target)}
                  onReaction={(target, emoji) => {
                    if (!user || !conversationId) return;
                    void toggleMessageReaction(
                      conversationId,
                      target.id,
                      user.id,
                      target.reactions?.[user.id] ?? null,
                      emoji
                    );
                  }}
                />
              </div>
            );
          })
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
        {/* مؤشر "يكتب الآن…" */}
        <AnimatePresence>
          {peerTyping && <TypingIndicator />}
        </AnimatePresence>
        <AnimatePresence>
          {showJumpToLatest && (
            <motion.button
              type='button'
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              onClick={jumpToLatest}
              className='sticky bottom-2 z-20 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-main-accent px-3 py-2 text-xs font-bold text-black shadow-lg'
            >
              <HeroIcon className='h-4 w-4' iconName='ArrowDownIcon' />
              أحدث الرسائل
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* مربع الكتابة */}
      <div className='border-t border-light-border dark:border-dark-border'>
        {user && conversation && (
          <ChatComposer
            sending={sending}
            replyingTo={
              replyTarget
                ? {
                    senderName:
                      replyTarget.senderId === user?.id
                        ? user?.name ?? 'أنت'
                        : peer?.name ?? 'مستخدم',
                    text: replyTarget.text,
                    type: replyTarget.type
                  }
                : null
            }
            onCancelReply={() => setReplyTarget(null)}
            onSendText={(text) => void handleSend({ type: 'text', text })}
            onSendMedia={(files, kind) =>
              void handleSend({ type: kind, files })
            }
            onSendVoice={(blob, duration, peaks) =>
              void handleSend({ type: 'audio', blob, duration, peaks })
            }
            onTyping={(typing) => {
              if (!conversationId || !user) return;
              void setTyping(conversationId, typing ? user.id : null).catch(
                () => undefined
              );
            }}
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
