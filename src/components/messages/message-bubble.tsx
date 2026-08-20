import { useRef, useState } from 'react';
import Link from 'next/link';
import cn from 'clsx';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform
} from 'framer-motion';
import { VoicePlayer } from './voice-player';
import { ImagePreview } from '@components/input/image-preview';
import { HeroIcon } from '@components/ui/hero-icon';
import { LinkifiedText } from '@components/ui/linkified-text';
import type { Message, MessageType } from '@lib/types/message';

type MessageBubbleProps = {
  message: Message;
  isOwn: boolean;
  /** معرّف المستخدم الحالي لتمييز تفاعله */
  viewerId?: string;
  /** اسحب الرسالة أفقيًا لتفعيل الرد */
  onReply?: (message: Message) => void;
  /** التفاعل بالإيموجي مع الرسالة (تمرير نفس الإيموجي يحذفه) */
  onReaction?: (message: Message, emoji: string) => void;
};

const SWIPE_THRESHOLD = 56;

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

const replyLabels: Record<Exclude<MessageType, 'text'>, string> = {
  image: 'صورة',
  video: 'فيديو',
  audio: 'رسالة صوتية',
  shared: 'منشور'
};

function formatTime(createdAt: Message['createdAt']): string {
  const date = createdAt?.toDate ? createdAt.toDate() : new Date();
  return new Intl.DateTimeFormat('ar', {
    hour: 'numeric',
    minute: 'numeric'
  }).format(date);
}

export function MessageBubble({
  message,
  isOwn,
  viewerId,
  onReply,
  onReaction
}: MessageBubbleProps): JSX.Element {
  const {
    type,
    text,
    media,
    audio,
    replyTo,
    sharedPost,
    reactions,
    createdAt,
    seenBy
  } = message;
  const seen = seenBy?.length > 1;

  // سحب أفقي انسيابي — الفقاعة تميل وتتوهج ويكشف زر الرد خلفها
  const dragX = useMotionValue(0);
  const [triggered, setTriggered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);

  const rotate = useTransform(dragX, [-80, 0, 80], [-4, 0, 4]);
  const replyScale = useTransform(dragX, (v) =>
    Math.min(Math.abs(v) / SWIPE_THRESHOLD, 1.35)
  );
  const replyOpacity = useTransform(dragX, (v) =>
    Math.min(Math.abs(v) / (SWIPE_THRESHOLD * 0.5), 1)
  );
  const glowScaleX = useTransform(dragX, (v) =>
    Math.min(Math.abs(v) / SWIPE_THRESHOLD, 1.6)
  );

  const myReaction = viewerId ? (reactions ?? {})[viewerId] : undefined;
  const reactionGroups = Object.values(reactions ?? {}).reduce<
    Record<string, number>
  >((acc, emoji) => {
    acc[emoji] = (acc[emoji] ?? 0) + 1;
    return acc;
  }, {});

  const handleDragEnd = (): void => {
    if (Math.abs(dragX.get()) >= SWIPE_THRESHOLD && onReply) {
      setTriggered(true);
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
      onReply(message);
    }
  };

  const react = (emoji: string): void => {
    setPickerOpen(false);
    onReaction?.(message, emoji);
  };

  // نقر سريع مزدوج = قلب
  const tapRef = useRef<number>(0);
  const handlePointerUp = (): void => {
    if (Math.abs(dragX.get()) > 12) return;
    const now = Date.now();
    if (now - tapRef.current < 300) {
      tapRef.current = 0;
      setHeartBurst((value) => value + 1);
      react('❤️');
    } else {
      tapRef.current = now;
    }
  };

  // ضغطة مطوّلة تفتح منتقي التفاعلات (تلغى بأي حركة أفقية)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePointerDown = (): void => {
    if (!onReaction) return;
    pressTimer.current = setTimeout(() => setPickerOpen(true), 450);
  };
  const cancelPress = (): void => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const bubbleClass = cn(
    'max-w-[78%] xs:max-w-[70%]',
    type === 'text'
      ? cn(
          'rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-lg backdrop-blur-xl',
          isOwn
            ? 'rounded-br-md border border-white/30 bg-main-accent/85 text-black'
            : `rounded-bl-md border border-black/10 bg-black/5 text-light-primary
               dark:border-white/15 dark:bg-white/10 dark:text-dark-primary`
        )
      : type === 'audio'
      ? cn(
          'rounded-2xl px-3 py-2 shadow-lg backdrop-blur-xl',
          isOwn
            ? 'rounded-br-md border border-white/30 bg-main-accent/85'
            : 'rounded-bl-md border border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10'
        )
      : 'overflow-hidden rounded-2xl shadow-lg',
    isOwn ? 'self-end' : 'self-start'
  );

  const replyQuote = replyTo && (
    <div
      className={cn(
        'relative mb-1.5 overflow-hidden rounded-xl px-3 py-1.5 ps-4 text-xs',
        isOwn ? 'bg-black/15' : 'bg-black/5 dark:bg-white/10'
      )}
    >
      <span
        className='absolute inset-y-0 start-0 w-[3px] rounded-full bg-gradient-to-b
                   from-main-accent via-main-accent/70 to-transparent'
      />
      <span className='flex items-center gap-1 font-bold opacity-80'>
        <HeroIcon
          className='h-3 w-3 rotate-180'
          iconName='ArrowUturnLeftIcon'
        />
        {replyTo.senderName ?? 'رسالة'}
      </span>
      <span className='block truncate opacity-70'>
        {replyTo.text ||
          replyLabels[replyTo.type as Exclude<MessageType, 'text'>] ||
          ''}
      </span>
    </div>
  );

  return (
    <motion.div
      className={cn(
        'relative flex w-full flex-col gap-1',
        isOwn ? 'items-end' : 'items-start'
      )}
      drag='x'
      dragDirectionLock
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.24, right: 0.24 }}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 28 }}
      style={{ x: dragX, rotate }}
      onDrag={() => {
        setTriggered(false);
        cancelPress();
      }}
      onDragEnd={handleDragEnd}
      initial={triggered ? { scale: 0.97 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {/* وهج مرن خلف الفقاعة أثناء السحب */}
      <motion.span
        aria-hidden
        className={cn(
          'absolute inset-y-2 w-24 rounded-full bg-main-accent/25 blur-md',
          isOwn ? 'end-1/2' : 'start-1/2'
        )}
        style={{ scaleX: glowScaleX, opacity: replyOpacity }}
      />

      {/* زر الرد الظاهر خلف الفقاعة أثناء السحب */}
      <motion.div
        aria-hidden
        className={cn(
          'absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full',
          'bg-main-accent text-black shadow-lg shadow-main-accent/40',
          isOwn ? '-start-2' : '-end-2'
        )}
        style={{ scale: replyScale, opacity: replyOpacity }}
      >
        <HeroIcon
          className='h-4 w-4 rotate-180'
          iconName='ArrowUturnLeftIcon'
          solid
        />
      </motion.div>

      {/* انفجار القلب عند النقر المزدوج — قلب نابض مع بارتكلات حلقية */}
      <AnimatePresence>
        {!!heartBurst && (
          <motion.span
            key={heartBurst}
            aria-hidden
            className='pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2'
          >
            <motion.span
              className='block text-4xl'
              initial={{ scale: 0, opacity: 0, rotate: -15 }}
              animate={{
                scale: [0, 1.45, 1.15],
                opacity: [0, 1, 1],
                rotate: [-15, 5, 0]
              }}
              exit={{ opacity: 0, y: -24, scale: 0.4 }}
              transition={{
                scale: { type: 'spring', stiffness: 400, damping: 15 },
                duration: 0.9
              }}
            >
              ❤️
            </motion.span>
            {[-2, -1.2, -0.4, 0.4, 1.2, 2].map((turn, index) => (
              <motion.span
                key={index}
                className='absolute text-xs'
                initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
                animate={{
                  scale: 1.1,
                  opacity: 0,
                  x: Math.cos(turn * Math.PI * 0.5) * 44,
                  y: Math.sin(turn * Math.PI * 0.5) * 44
                }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                💛
              </motion.span>
            ))}
          </motion.span>
        )}
      </AnimatePresence>

      {/* منتقي التفاعلات بالضغطة المطوّلة — تصميم يطابق قائمة المنشور (menu-container) */}
      {pickerOpen && (
        <button
          className='fixed inset-0 z-20 cursor-default'
          aria-label='إغلاق المنتقي'
          onClick={() => setPickerOpen(false)}
          type='button'
        />
      )}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 6 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={cn(
              `menu-container absolute z-30 w-max max-w-xs overflow-hidden
               rounded-md bg-main-background`,
              isOwn ? 'right-0' : 'left-0',
              '-top-14'
            )}
          >
            {/* شريط التفاعلات */}
            <div className='flex items-center gap-0.5 px-2 py-1'>
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className={cn(
                    'rounded-full p-1 text-xl transition hover:-translate-y-0.5 hover:scale-125',
                    myReaction === emoji && 'bg-main-accent/20'
                  )}
                  onClick={() => react(emoji)}
                  type='button'
                >
                  {emoji}
                </button>
              ))}
            </div>
            {/* رد — بأسلوب عناصر قائمة المنشور */}
            {onReply && (
              <button
                className='accent-tab flex w-full items-center gap-3 border-t border-light-border/60 p-3
                           text-light-primary hover:bg-main-sidebar-background dark:border-dark-border/60
                           dark:text-dark-primary'
                onClick={() => {
                  setPickerOpen(false);
                  onReply(message);
                }}
                type='button'
              >
                <HeroIcon
                  className='h-5 w-5 rotate-180'
                  iconName='ArrowUturnLeftIcon'
                />
                رد على الرسالة
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(bubbleClass, 'relative z-10')}
        dir='auto'
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={() => Math.abs(dragX.get()) > 8 && cancelPress()}
      >
        {replyQuote}

        {type === 'text' && (
          <p className='whitespace-pre-wrap break-words'>
            {text && (
              <LinkifiedText
                text={text}
                linkClassName={
                  isOwn
                    ? 'break-all font-semibold text-[#0b3d91] underline underline-offset-2'
                    : undefined
                }
              />
            )}
          </p>
        )}

        {(type === 'image' || type === 'video') && media && (
          <div className='min-w-[230px] xs:min-w-[290px] md:min-w-[330px]'>
            <ImagePreview
              tweet
              chat
              imagesPreview={media.map((item, index) => ({
                id: `${message.id}-${index}`,
                src: item.src,
                alt: item.alt || 'معاينة',
                type: item.type || (type === 'video' ? 'video/mp4' : undefined)
              }))}
              previewCount={media.length}
            />
          </div>
        )}

        {type === 'audio' && audio && (
          <VoicePlayer
            src={audio.src}
            duration={audio.duration}
            peaks={audio.peaks}
            isOwn={isOwn}
          />
        )}

        {type === 'shared' && sharedPost && (
          <Link
            href={
              sharedPost.kind === 'reel'
                ? `/reels?video=${sharedPost.id}`
                : `/tweet/${sharedPost.id}`
            }
          >
            <a
              className={cn(
                'block min-w-[230px] max-w-[300px] overflow-hidden rounded-xl border bg-main-background/70 backdrop-blur-md xs:min-w-[290px]',
                isOwn
                  ? 'border-black/15 text-black'
                  : 'border-black/10 text-light-primary dark:border-white/15 dark:text-dark-primary'
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {sharedPost.thumbnail && (
                <img
                  className='h-32 w-full object-cover'
                  src={sharedPost.thumbnail}
                  alt='معاينة المنشور'
                />
              )}
              <div className='flex items-center gap-2 px-3 pt-2.5'>
                {sharedPost.authorPhoto && (
                  <img
                    className='h-7 w-7 rounded-full object-cover'
                    src={sharedPost.authorPhoto}
                    alt={sharedPost.authorName ?? ''}
                  />
                )}
                <div className='min-w-0 flex-1 leading-tight'>
                  <p className='truncate text-sm font-bold'>
                    {sharedPost.authorName ?? 'مستخدم'}
                  </p>
                  {sharedPost.authorUsername && (
                    <p className='truncate text-[11px] opacity-60'>
                      @{sharedPost.authorUsername}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    isOwn ? 'bg-black/15' : 'bg-main-accent/15 text-main-accent'
                  )}
                >
                  {sharedPost.kind === 'reel' ? 'ريل' : 'منشور'}
                </span>
              </div>
              {sharedPost.text && (
                <p className='line-clamp-2 px-3 pb-2.5 pt-1 text-[13px] opacity-80'>
                  {sharedPost.text}
                </p>
              )}
            </a>
          </Link>
        )}

        {text && type !== 'text' && (
          <p
            className={cn(
              'mt-1 whitespace-pre-wrap break-words px-2 pb-1 text-[15px]',
              isOwn ? 'text-black' : 'text-light-primary dark:text-dark-primary'
            )}
          >
            <LinkifiedText
              text={text}
              linkClassName={
                isOwn
                  ? 'break-all font-semibold text-[#0b3d91] underline underline-offset-2'
                  : undefined
              }
            />
          </p>
        )}
      </div>

      {/* تفاعلات الرسالة + الوقت ومؤشر القراءة */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-1 text-[11px] text-light-secondary dark:text-dark-secondary',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <span>{formatTime(createdAt)}</span>
        {isOwn && (
          <HeroIcon
            className={cn('h-3.5 w-3.5', seen && 'text-main-accent')}
            iconName={seen ? 'CheckCircleIcon' : 'CheckIcon'}
            solid={seen}
          />
        )}
        {Object.entries(reactionGroups).map(([emoji, count]) => (
          <span
            key={emoji}
            className='flex items-center gap-0.5 rounded-full border border-light-border bg-main-search-background
                       px-1.5 py-0.5 text-[11px] leading-none dark:border-dark-border'
          >
            {emoji}
            {count > 1 && (
              <span className='text-[10px] font-bold'>{count}</span>
            )}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
