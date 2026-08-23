import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import cn from 'clsx';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform
} from 'framer-motion';
import { TweetAudioPlayer } from '@components/tweet/tweet-audio';
import { Modal } from '@components/modal/modal';
import { ImageModal } from '@components/modal/image-modal';
import { HeroIcon } from '@components/ui/hero-icon';
import { LinkifiedText } from '@components/ui/linkified-text';
import {
  isVideoUrl,
  useRepairableVideo,
  useVideoPoster
} from '@lib/media-normalize';
import type { ImageData } from '@lib/types/file';
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
  /** حذف الرسالة (للمرسل فقط) */
  onDelete?: (message: Message) => void;
};

const SWIPE_THRESHOLD = 56;

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
const HEART_PARTICLES = [
  { x: -42, y: -55, r: -25, s: 0.85, delay: 0 },
  { x: 42, y: -52, r: 25, s: 0.82, delay: 0.03 },
  { x: -58, y: 8, r: -40, s: 0.7, delay: 0.02 },
  { x: 60, y: 12, r: 35, s: 0.85, delay: 0.04 },
  { x: 0, y: -68, r: 0, s: 0.95, delay: 0.01 },
  { x: 0, y: 58, r: 0, s: 0.68, delay: 0.06 }
];

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

type MessageVideoProps = {
  item: ImageData;
  onExpand: () => void;
};

function MessageVideo({ item, onExpand }: MessageVideoProps): JSX.Element {
  const { effectiveSrc, repairing, onError } = useRepairableVideo(item.src);
  const posterUrl = useVideoPoster(item.src, item.thumbnail ?? null);
  return (
    <div className='group relative'>
      <video
        key={effectiveSrc}
        className='block max-h-[360px] w-full rounded-2xl bg-black object-contain'
        src={effectiveSrc}
        poster={posterUrl ?? undefined}
        controls
        playsInline
        preload='metadata'
        onError={onError}
      />
      {repairing && (
        <div className='absolute inset-x-0 top-3 z-10 flex justify-center'>
          <div className='flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur'>
            <HeroIcon
              className='h-3.5 w-3.5 animate-spin'
              iconName='ArrowPathIcon'
            />
            جاري إصلاح الفيديو…
          </div>
        </div>
      )}
      <button
        type='button'
        onClick={onExpand}
        aria-label='فتح معاينة الفيديو'
        className='absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100'
      >
        <HeroIcon className='h-5 w-5' iconName='ArrowsPointingOutIcon' />
      </button>
    </div>
  );
}

export function MessageBubble({
  message,
  isOwn,
  viewerId,
  onReply,
  onReaction,
  onDelete
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
  const isDeleted = !!message.deletedAt;

  // Shared cards carry the raw video URL as "thumbnail", which Android's
  // WebView cannot decode — render a server-extracted frame instead.
  const sharedThumb = sharedPost?.thumbnail ?? null;
  const sharedPoster = useVideoPoster(sharedThumb ?? '', sharedThumb);
  const sharedIsVideo = isVideoUrl(sharedThumb);

  // سحب أفقي انسيابي — الفقاعة تميل وتتوهج ويكشف زر الرد خلفها
  const dragX = useMotionValue(0);
  const [triggered, setTriggered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ left: 16, top: 16 });
  const [swipeReady, setSwipeReady] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(
    null
  );
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  // نخفي القلب تلقائيًا بعد فترة قصيرة حتى لا يلصق على الصفحة
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!heartBurst) return;
    if (heartTimer.current) clearTimeout(heartTimer.current);
    heartTimer.current = setTimeout(() => setHeartBurst(0), 1300);
    return () => {
      if (heartTimer.current) clearTimeout(heartTimer.current);
    };
  }, [heartBurst]);

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
    const shouldReply = Math.abs(dragX.get()) >= SWIPE_THRESHOLD && !!onReply;
    setSwipeReady(false);
    if (shouldReply && onReply) {
      setTriggered(true);
      try {
        navigator.vibrate?.(18);
      } catch {
        /* Haptics are optional. */
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
    cancelPress();
    if (Math.abs(dragX.get()) > 12) return;
    const now = Date.now();
    if (now - tapRef.current < 300 && onReaction) {
      tapRef.current = 0;
      try {
        navigator.vibrate?.(10);
      } catch {
        /* Haptics are optional. */
      }
      setHeartBurst((value) => value + 1);
      react('❤️');
    } else {
      tapRef.current = now;
    }
  };

  // منتقي التفاعل لا يعمل إلا مع ضغط ثابت. نلغي المؤقت فور السحب أو الرفع
  // حتى لا يظهر أثناء التمرير أو بعد نقرتين متتاليتين.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = (): void => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  };
  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ): void => {
    if (!onReaction || (event.pointerType === 'mouse' && event.button !== 0))
      return;
    pressStart.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      // Position the sheet in viewport coordinates so a scroll container never
      // clips it. Prefer below the touch, then above, and finally clamp safely.
      const point = pressStart.current ?? {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      };
      const width = Math.min(264, window.innerWidth - 24);
      const height = 210;
      const left = Math.min(
        Math.max(12, point.x - width / 2),
        window.innerWidth - width - 12
      );
      const below = point.y + 18;
      const above = point.y - height - 18;
      const top =
        below + height <= window.innerHeight - 12
          ? below
          : above >= 12
          ? above
          : Math.max(12, Math.min(below, window.innerHeight - height - 12));
      setPickerPosition({ left, top });
      try {
        navigator.vibrate?.(12);
      } catch {
        /* optional */
      }
      setPickerOpen(true);
    }, 620);
  };
  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ): void => {
    const start = pressStart.current;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10)
      cancelPress();
  };

  const bubbleClass = cn(
    'max-w-[78%] xs:max-w-[70%]',
    type === 'text'
      ? cn(
          'rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-lg backdrop-blur-xl',
          isOwn
            ? 'rounded-br-md border border-blue-300/30 bg-[#1d4ed8]/90 text-white shadow-[0_10px_30px_rgba(29,78,216,0.28)] backdrop-blur-2xl dark:border-blue-200/25'
            : `rounded-bl-md border border-black/10 bg-black/5 text-light-primary
               dark:border-white/15 dark:bg-white/10 dark:text-dark-primary`
        )
      : type === 'audio'
      ? 'w-full max-w-[320px] rounded-2xl'
      : 'overflow-hidden rounded-2xl shadow-lg',
    isOwn ? 'ml-auto mr-0 self-end' : 'mr-auto ml-0 self-start'
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
        isOwn ? 'ml-auto items-end' : 'mr-auto items-start'
      )}
      drag='x'
      dragDirectionLock
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.24, right: 0.24 }}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 28 }}
      style={{ x: dragX, rotate }}
      onDrag={(_, info) => {
        setTriggered(false);
        cancelPress();
        setSwipeReady(Math.abs(info.offset.x) >= SWIPE_THRESHOLD);
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
          'absolute top-1/2 flex h-10 -translate-y-1/2 items-center gap-1.5 rounded-full px-2',
          'bg-main-accent text-main-accent-contrast shadow-lg shadow-main-accent/40',
          swipeReady && 'ring-4 ring-main-accent/25',
          isOwn ? '-start-2' : '-end-2'
        )}
        style={{ scale: replyScale, opacity: replyOpacity }}
      >
        <HeroIcon
          className='h-4 w-4 rotate-180'
          iconName='ArrowUturnLeftIcon'
          solid
        />
        <span className='text-[10px] font-black'>
          {swipeReady ? 'حرّر للرد' : 'اسحب'}
        </span>
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
              className='relative block'
              initial={{ scale: 0, rotate: -15, opacity: 0 }}
              animate={{
                scale: [0, 1.35, 1, 1.15, 0],
                rotate: [-15, 8, -4, 0, 0],
                y: [0, -10, -20, -35, -50],
                opacity: [0, 1, 1, 0.9, 0]
              }}
              transition={{
                duration: 0.85,
                times: [0, 0.22, 0.45, 0.75, 1],
                ease: 'easeOut'
              }}
            >
              <HeroIcon
                className='h-24 w-24 text-rose-500 drop-shadow-[0_8px_24px_rgba(244,63,94,0.85)]'
                iconName='HeartIcon'
                solid
              />
            </motion.span>
            {HEART_PARTICLES.map((particle, index) => (
              <motion.span
                key={index}
                className='absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2'
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{
                  x: particle.x,
                  y: [0, particle.y * 0.85, particle.y - 30],
                  scale: [0, particle.s, particle.s * 0.9, 0],
                  opacity: [0, 1, 0.85, 0],
                  rotate: particle.r
                }}
                transition={{
                  duration: 0.75,
                  delay: particle.delay,
                  ease: 'easeOut'
                }}
              >
                <HeroIcon
                  className='h-5 w-5 text-rose-400 drop-shadow-[0_4px_10px_rgba(244,63,94,0.7)]'
                  iconName='HeartIcon'
                  solid
                />
              </motion.span>
            ))}
          </motion.span>
        )}
      </AnimatePresence>

      {/* منتقي التفاعلات بالضغطة المطوّلة — تصميم يطابق قائمة المنشور (menu-container) */}
      {pickerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <button
              className='fixed inset-0 z-[60] cursor-default'
              aria-label='إغلاق المنتقي'
              onClick={() => setPickerOpen(false)}
              type='button'
            />
            <AnimatePresence>
              {pickerOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 6 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className='fixed z-[70] w-[min(264px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-white/20 bg-main-background/95 shadow-2xl shadow-black/25 backdrop-blur-xl dark:border-white/10'
                  style={{ left: pickerPosition.left, top: pickerPosition.top }}
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
                  {/* حذف الرسالة (للمرسل فقط) */}
                  {isOwn && onDelete && (
                    <button
                      className='accent-tab flex w-full items-center gap-3 border-t border-light-border/60 p-3
                           text-red-500 hover:bg-red-500/10 dark:border-dark-border/60'
                      onClick={() => {
                        setPickerOpen(false);
                        onDelete(message);
                      }}
                      type='button'
                    >
                      <HeroIcon className='h-5 w-5' iconName='TrashIcon' />
                      حذف الرسالة
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}

      {/* حاوية الفقاعة + التفاعلات - التفاعل ملتصق بالفقاعة */}
      <div
        className={cn(
          'relative z-10 flex flex-col',
          'max-w-[78%] xs:max-w-[70%]',
          isOwn
            ? 'ml-auto mr-0 items-end self-end'
            : 'ml-0 mr-auto items-start self-start'
        )}
      >
        <div
          className={cn(
            bubbleClass,
            'relative !ml-0 !mr-0 w-full !max-w-full !self-auto'
          )}
          dir='auto'
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={cancelPress}
          onPointerMove={(event) => {
            if (Math.abs(dragX.get()) > 8) cancelPress();
            else handlePointerMove(event);
          }}
        >
          {isDeleted ? (
            <div className='flex items-center gap-2 px-1 py-1 text-sm italic opacity-65'>
              <HeroIcon className='h-4 w-4' iconName='NoSymbolIcon' />
              تم حذف هذه الرسالة
            </div>
          ) : (
            <>
              {replyQuote}

              {type === 'text' && (
                <p className='whitespace-pre-wrap break-words'>
                  {text && (
                    <LinkifiedText
                      text={text}
                      linkClassName={
                        isOwn
                          ? 'break-all font-semibold text-blue-100 underline underline-offset-2'
                          : undefined
                      }
                    />
                  )}
                </p>
              )}

              {(type === 'image' || type === 'video') && media && (
                <div className='w-fit max-w-[75vw] overflow-hidden rounded-2xl xs:max-w-[330px]'>
                  {media.map((item, index) =>
                    type === 'video' || item.type?.startsWith('video/') ? (
                      <MessageVideo
                        key={`${message.id}-${index}`}
                        item={item}
                        onExpand={() => setSelectedMediaIndex(index)}
                      />
                    ) : (
                      <button
                        key={`${message.id}-${index}`}
                        type='button'
                        onClick={() => setSelectedMediaIndex(index)}
                        className='group relative block cursor-zoom-in overflow-hidden rounded-2xl outline-none'
                        aria-label='فتح معاينة الصورة'
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className='block max-h-[360px] w-full rounded-2xl object-contain transition duration-300 group-hover:scale-[1.02]'
                          src={item.src}
                          alt={item.alt || 'صورة'}
                          loading='lazy'
                        />
                        <span className='absolute inset-0 bg-black/0 transition group-hover:bg-black/10' />
                        <HeroIcon
                          className='absolute left-3 top-3 h-5 w-5 rounded-full bg-black/45 p-1 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100'
                          iconName='ArrowsPointingOutIcon'
                        />
                      </button>
                    )
                  )}
                </div>
              )}

              {type === 'audio' && audio && <TweetAudioPlayer audio={audio} />}

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
                      'block max-w-full overflow-hidden rounded-2xl border bg-main-background/95 shadow-lg shadow-black/10 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-xl',
                      sharedPost.kind === 'reel'
                        ? 'w-[min(220px,calc(100vw-140px))]'
                        : 'w-[min(320px,calc(100vw-88px))]',
                      'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50'
                    )}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {sharedPost.thumbnail ? (
                      <div
                        className={cn(
                          'relative overflow-hidden bg-slate-100 dark:bg-slate-900',
                          sharedPost.kind === 'reel' ? 'aspect-[4/5]' : 'h-36'
                        )}
                      >
                        {sharedIsVideo ? (
                          sharedPoster ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className='pointer-events-none h-full w-full object-cover transition duration-500 hover:scale-105'
                              src={sharedPoster}
                              alt='معاينة الفيديو'
                              draggable={false}
                            />
                          ) : (
                            // أثناء تجهيز البوستر: اعرض أول إطار من الفيديو نفسه
                            <video
                              className='pointer-events-none h-full w-full object-cover'
                              src={`${sharedPost.thumbnail ?? ''}#t=0.1`}
                              muted
                              playsInline
                              preload='metadata'
                            />
                          )
                        ) : (
                          <img
                            className='pointer-events-none h-full w-full object-cover transition duration-500 hover:scale-105'
                            src={sharedPost.thumbnail ?? ''}
                            alt='معاينة المنشور'
                            draggable={false}
                          />
                        )}
                        {(sharedPost.kind === 'reel' || sharedIsVideo) && (
                          <>
                            <span className='absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10' />
                            <span className='absolute inset-0 flex items-center justify-center'>
                              <HeroIcon
                                className='h-14 w-14 rounded-full bg-black/60 p-3.5 text-white shadow-xl backdrop-blur-sm'
                                iconName='PlayIcon'
                                solid
                              />
                            </span>
                            {sharedPost.kind === 'reel' && (
                              <span className='absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur'>
                                ريل
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className='flex h-24 items-center justify-center bg-gradient-to-br from-main-accent/20 to-main-accent/5 text-main-accent-text'>
                        <HeroIcon
                          className='h-9 w-9'
                          iconName={
                            sharedPost.kind === 'reel'
                              ? 'FilmIcon'
                              : 'DocumentTextIcon'
                          }
                        />
                      </div>
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
                          isOwn
                            ? 'bg-black/15'
                            : 'bg-main-accent/15 text-main-accent-text'
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
                  className='mt-1 whitespace-pre-wrap break-words px-2 pb-1
                             text-[15px] text-light-primary dark:text-dark-primary'
                >
                  <LinkifiedText text={text} />
                </p>
              )}
            </>
          )}
        </div>

        {/* التفاعلات ملتصقة بفقاعة الرسالة - تصحيح الموضع */}
        {Object.keys(reactionGroups).length > 0 && (
          <div
            className={cn(
              'absolute z-20 flex items-center gap-0.5 rounded-full border border-light-border bg-main-background px-1.5 py-0.5 shadow-md backdrop-blur-sm dark:border-dark-border dark:bg-slate-800',
              'bottom-0 translate-y-1/2',
              isOwn
                ? 'left-0 -translate-x-1.5' // رسائلي على اليمين -> التفاعل على يسار الفقاعة من الأسفل
                : 'right-0 translate-x-1.5' // رسائل الآخر على اليسار -> التفاعل على يمين الفقاعة من الأسفل
            )}
          >
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <span
                key={emoji}
                className='flex items-center gap-0.5 text-[12px] leading-none'
              >
                <span>{emoji}</span>
                {count > 1 && (
                  <span className='text-[10px] font-bold'>{count}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* الوقت ومؤشر القراءة - منفصل عن التفاعلات */}
      <div
        className={cn(
          'flex min-h-4 items-center gap-1.5 px-1 text-[11px] text-light-secondary dark:text-dark-secondary',
          'mt-1',
          isOwn ? 'self-end' : 'self-start',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <span>{formatTime(createdAt)}</span>
        {isOwn && (
          <HeroIcon
            className={cn('h-3.5 w-3.5', seen && 'text-main-accent-text')}
            iconName={seen ? 'CheckCircleIcon' : 'CheckIcon'}
            solid={seen}
          />
        )}
      </div>
      {selectedMediaIndex !== null && media?.[selectedMediaIndex] && (
        <Modal
          open
          closeModal={() => setSelectedMediaIndex(null)}
          modalClassName='relative flex w-full max-w-4xl items-center justify-center'
        >
          <ImageModal
            imageData={media[selectedMediaIndex]}
            previewCount={media.length}
            onClose={() => setSelectedMediaIndex(null)}
          />
        </Modal>
      )}
    </motion.div>
  );
}
