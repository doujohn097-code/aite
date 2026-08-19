import { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@lib/firebase/app';
import { setMessageReaction, toggleMessageLike } from '@lib/firebase/utils';
import { HeroIcon } from '@components/ui/hero-icon';
import { Modal } from '@components/modal/modal';
import { UserAvatar } from '@components/user/user-avatar';
import type { Message } from '@lib/types/message';
import { formatDate } from '@lib/date';
import { useModal } from '@lib/hooks/useModal';
import { useAuth } from '@lib/context/auth-context';
import { AudioPlayer } from './audio-player';

type MessageListProps = {
  messages: Message[];
  currentUserId: string;
  participantData: { photoURL: string; name: string } | null;
  conversationId: string;
  onReply: (message: Message) => void;
};

type ContextMenuState = {
  message: Message;
  x: number;
  y: number;
} | null;

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export function MessageList({
  messages,
  currentUserId,
  participantData,
  conversationId,
  onReply
}: MessageListProps): JSX.Element {
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const { open, openModal, closeModal } = useModal();
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [heartId, setHeartId] = useState<string | null>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const handleResize = (): void => {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    window.addEventListener('resize', handleResize);
    return (): void => window.removeEventListener('resize', handleResize);
  }, []);

  const handleImageClick = (src: string, alt: string) => (): void => {
    setSelectedImage({ src, alt });
    openModal();
  };

  const handleReaction = (messageId: string, emoji: string) => async (): Promise<void> => {
    const currentEmoji = messages.find((m) => m.id === messageId)?.reactions?.[currentUserId];
    await setMessageReaction(conversationId, messageId, currentUserId, currentEmoji === emoji ? null : emoji);
  };

  const handleLike = async (message: Message): Promise<void> => {
    setHeartId(message.id);
    setTimeout(() => setHeartId(null), 700);
    const liked = message.likes?.includes(currentUserId) ?? false;
    await toggleMessageLike(conversationId, message.id, currentUserId, !liked);
  };

  const handleReply = (message: Message) => (): void => {
    onReply(message);
    setContextMenu(null);
  };

  const handleDelete = (message: Message) => async (): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'conversations', conversationId, 'messages', message.id));
    } catch {
      // noop
    }
    setContextMenu(null);
  };

  const showMenu = (message: Message) => (
    e: React.MouseEvent | React.TouchEvent | React.PointerEvent
  ): void => {
    e.preventDefault();
    if ('touches' in e && e.touches?.[0]) {
      const touch = e.touches[0];
      setContextMenu({ message, x: touch.clientX, y: touch.clientY });
    } else {
      const event = e as React.MouseEvent | React.PointerEvent;
      setContextMenu({ message, x: event.clientX, y: event.clientY });
    }
  };

  const closeMenu = (): void => setContextMenu(null);

  return (
    <>
      <div
        ref={listRef}
        className='flex flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain
                   [-webkit-overflow-scrolling:touch] px-4 py-3'
        onClick={closeMenu}
        onScroll={closeMenu}
      >
        <div className='flex-grow' />
        {messages.map((message, i) => {
          const isNew = i === messages.length - 1;
          return (
            <MessageBubble
              key={message.id}
              message={message}
              currentUserId={currentUserId}
              isNew={isNew}
              participantData={participantData}
              onImageClick={handleImageClick}
              onReaction={handleReaction}
              onLike={handleLike}
              onReply={handleReply(message)}
              onContextMenu={showMenu(message)}
              showHeart={heartId === message.id}
            />
          );
        })}
        <div ref={listEndRef} />
      </div>

      <AnimatePresence>
        {contextMenu && (
          <MessageContextMenu
            {...contextMenu}
            currentUserId={currentUserId}
            onReact={handleReaction}
            onReply={handleReply(contextMenu.message)}
            onDelete={handleDelete(contextMenu.message)}
            onClose={closeMenu}
          />
        )}
      </AnimatePresence>

      <Modal
        modalClassName='bg-black/80 backdrop-blur-sm'
        className='flex items-center justify-center'
        open={open}
        closeModal={closeModal}
      >
        {selectedImage && (
          <picture className='max-w-full p-2 md:max-w-3xl md:p-4' tabIndex={0}>
            <img
              className='max-h-[70vh] rounded-lg object-contain md:max-h-[80vh]'
              src={selectedImage.src}
              alt={selectedImage.alt}
              tabIndex={-1}
            />
          </picture>
        )}
      </Modal>
    </>
  );
}

function MessageContextMenu({
  x,
  y,
  message,
  currentUserId,
  onReact,
  onReply,
  onDelete,
  onClose
}: {
  x: number;
  y: number;
  message: Message;
  currentUserId: string;
  onReact: (id: string, emoji: string) => () => Promise<void>;
  onReply: () => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
}): JSX.Element {
  const mountTimeRef = useRef<number>(Date.now());

  const handleBackdropClick = (): void => {
    if (Date.now() - mountTimeRef.current < 350) return;
    onClose();
  };

  return (
    <>
      <div className='fixed inset-0 z-40' onClick={handleBackdropClick} />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{
          top: Math.max(8, Math.min(y, window.innerHeight - 160)),
          left: Math.max(8, Math.min(x, window.innerWidth - 176))
        }}
        className='fixed z-50 flex w-44 flex-col gap-2 rounded-2xl border border-white/20 
                   bg-black/60 p-2 shadow-2xl backdrop-blur-xl'
      >
        <div className='flex justify-between border-b border-white/10 pb-2'>
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type='button'
              onClick={onReact(message.id, emoji)}
              className='text-lg transition hover:scale-125'
            >
              {emoji}
            </button>
          ))}
        </div>
        <button
          type='button'
          onClick={onReply}
          className='flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm 
                     text-white transition hover:bg-white/10'
        >
          <HeroIcon iconName='ArrowUturnRightIcon' className='h-4 w-4 rotate-180' />
          رد
        </button>
        {message.senderId === currentUserId && (
          <button
            type='button'
            onClick={onDelete}
            className='flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm 
                       text-red-400 transition hover:bg-red-500/10'
          >
            <HeroIcon iconName='TrashIcon' className='h-4 w-4' />
            حذف
          </button>
        )}
      </motion.div>
    </>
  );
}

function MessageReactions({
  message,
  currentUserId,
  onReaction
}: {
  message: Message;
  currentUserId: string;
  onReaction: (id: string, emoji: string) => () => Promise<void>;
}): JSX.Element | null {
  const counts = useMemo(() => {
    const map = new Map<string, string[]>();
    Object.entries(message.reactions ?? {}).forEach(([userId, emoji]) => {
      const list = map.get(emoji) ?? [];
      list.push(userId);
      map.set(emoji, list);
    });
    return map;
  }, [message.reactions]);

  if (!counts.size) return null;

  return (
    <div className='mt-1 flex flex-wrap items-center gap-1'>
      <AnimatePresence>
        {Array.from(counts.entries()).map(([emoji, users]) => {
          const isMine = message.reactions?.[currentUserId] === emoji;
          return (
            <motion.button
              key={emoji}
              type='button'
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={onReaction(message.id, emoji)}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs 
                          backdrop-blur-sm transition ${
                            isMine
                              ? 'border-main-accent/50 bg-main-accent/20 text-main-accent'
                              : 'border-white/20 bg-white/10 text-white'
                          }`}
            >
              <span>{emoji}</span>
              <span>{users.length}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({
  message,
  currentUserId,
  isNew,
  participantData,
  onImageClick,
  onReaction,
  onLike,
  onReply,
  onContextMenu,
  showHeart
}: {
  message: Message;
  currentUserId: string;
  isNew: boolean;
  participantData: { photoURL: string; name: string } | null;
  onImageClick: (src: string, alt: string) => () => void;
  onReaction: (id: string, emoji: string) => () => Promise<void>;
  onLike: (message: Message) => Promise<void>;
  onReply: () => void;
  onContextMenu: (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => void;
  showHeart: boolean;
}): JSX.Element {
  const isMe = message.senderId === currentUserId;
  const isLiked = message.likes?.includes(currentUserId);
  const { user: currentUser } = useAuth();

  const [lastTap, setLastTap] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const startRef = useRef({ x: 0, y: 0, t: 0 });
  const timerRef = useRef<number | null>(null);
  const longPressRef = useRef(false);
  const swipingRef = useRef(false);
  const pointerTypeRef = useRef('mouse');

  const avatarSrc = isMe ? currentUser?.photoURL : participantData?.photoURL;
  const avatarAlt = isMe ? currentUser?.name : participantData?.name;

  const clearLongPressTimer = (): void => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    longPressRef.current = false;
    swipingRef.current = false;
    pointerTypeRef.current = e.pointerType;
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    setSwipeX(0);

    timerRef.current = window.setTimeout(() => {
      longPressRef.current = true;
      onContextMenu(e);
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // noop
      }
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!startRef.current.t) return;

    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > 12 && absX > absY * 1.5) {
      clearLongPressTimer();
      swipingRef.current = true;
      setSwipeX(Math.min(Math.max(dx * 0.35, -72), 72));
    } else if (absY > 12 && absY > absX * 1.5) {
      clearLongPressTimer();
      startRef.current.t = 0;
      setSwipeX(0);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    clearLongPressTimer();
    const { x: sx, t } = startRef.current;
    startRef.current.t = 0;
    const dx = e.clientX - sx;

    if (longPressRef.current) {
      longPressRef.current = false;
      setSwipeX(0);
      return;
    }

    if (swipingRef.current) {
      swipingRef.current = false;
      setSwipeX(0);
      if (Math.abs(dx) > 60) {
        e.preventDefault();
        onReply();
      }
      return;
    }

    if (pointerTypeRef.current === 'touch') {
      const now = Date.now();
      if (t && now - lastTap < 250) {
        e.preventDefault();
        void onLike(message);
        setLastTap(0);
      } else {
        setLastTap(now);
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (pointerTypeRef.current === 'touch') return;
    if (longPressRef.current || swipingRef.current) return;

    const now = Date.now();
    if (now - lastTap < 300) {
      void onLike(message);
      setLastTap(0);
    } else {
      setLastTap(now);
    }
  };

  const bubbleClass = isMe
    ? 'bg-gradient-to-br from-white/95 to-white/75 text-black border border-white/40'
    : 'bg-gradient-to-br from-white/20 to-white/10 text-white border border-white/20';

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 20, scale: 0.95 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`group flex w-full items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <UserAvatar
        src={avatarSrc}
        alt={avatarAlt}
        username={isMe ? currentUserId : message.senderId}
        className='h-8 w-8 shrink-0'
      />
      <div className={`flex max-w-[75%] flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {message.replyTo && (
          <div
            className='mb-1 max-w-full truncate rounded-lg border-l-4 border-main-accent 
                       bg-white/5 px-2 py-1 text-xs text-white/70 backdrop-blur-sm'
          >
            {message.replyTo.text ?? 'صوت / صورة'}
          </div>
        )}
        <motion.div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={(e): void => {
            e.preventDefault();
            e.stopPropagation();
            clearLongPressTimer();
            if (longPressRef.current) return;
            longPressRef.current = true;
            onContextMenu(e);
          }}
          onClick={handleClick}
          animate={{ x: swipeX }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className={`relative cursor-pointer select-none touch-pan-y [-webkit-touch-callout:none] rounded-2xl px-4 py-2.5 shadow-lg
                      backdrop-blur-xl transition-transform active:scale-[0.98] ${bubbleClass}`}
        >
          {message.text && (
            <p className='whitespace-pre-wrap break-words text-[15px] leading-relaxed'>
              {message.text}
            </p>
          )}

          {message.audio && (
            <div className='mt-1 w-full min-w-0'>
              <AudioPlayer src={message.audio.src} duration={message.audio.duration} />
            </div>
          )}

          {message.images &&
            message.images.map((image) => (
              <button
                key={image.id}
                type='button'
                onClick={(e): void => {
                  e.stopPropagation();
                  onImageClick(image.src, image.alt || 'صورة')();
                }}
                className='mt-1 block overflow-hidden rounded-xl'
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className='max-h-60 w-full rounded-xl object-cover'
                />
              </button>
            ))}

          <AnimatePresence>
            {showHeart && (
              <motion.div
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 1.6, opacity: 0, y: -30 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className='pointer-events-none absolute inset-0 flex items-center justify-center'
              >
                <span className='text-4xl text-red-500 drop-shadow-lg'>❤️</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <MessageReactions
          message={message}
          currentUserId={currentUserId}
          onReaction={onReaction}
        />

        <div className='mt-1 flex items-center gap-1 px-1 text-[10px] text-white/50'>
          {isLiked && <span className='text-red-400'>❤️</span>}
          <span>{message.createdAt ? formatDate(message.createdAt, 'message') : ''}</span>
        </div>
      </div>
    </motion.div>
  );
}
