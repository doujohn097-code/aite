import { useState } from 'react';
import cn from 'clsx';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { VoicePlayer } from './voice-player';
import { ImagePreview } from '@components/input/image-preview';
import { HeroIcon } from '@components/ui/hero-icon';
import { LinkifiedText } from '@components/ui/linkified-text';
import type { Message, MessageType } from '@lib/types/message';

type MessageBubbleProps = {
  message: Message;
  isOwn: boolean;
  /** اسحب الرسالة أفقيًا لتفعيل الرد */
  onReply?: (message: Message) => void;
};

const SWIPE_THRESHOLD = 60;

const replyLabels: Record<Exclude<MessageType, 'text'>, string> = {
  image: 'صورة',
  video: 'فيديو',
  audio: 'رسالة صوتية'
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
  onReply
}: MessageBubbleProps): JSX.Element {
  const { type, text, media, audio, replyTo, createdAt, seenBy } = message;
  const seen = seenBy?.length > 1;

  // سحب أفقي مرن بالكامل — الفقاعة تميل وتتوهج ويكشف زر الرد في المؤخرة
  const dragX = useMotionValue(0);
  const [triggered, setTriggered] = useState(false);

  const rotate = useTransform(dragX, [-90, 0, 90], [-6, 0, 6]);
  const replyScale = useTransform(dragX, (v) =>
    Math.min(Math.abs(v) / SWIPE_THRESHOLD, 1.25)
  );
  const replyOpacity = useTransform(dragX, (v) =>
    Math.min(Math.abs(v) / (SWIPE_THRESHOLD * 0.6), 1)
  );
  // خط توهج مرن خلف الفقاعة يتمدد كلما سحبت أكثر
  const glowScaleX = useTransform(dragX, (v) =>
    Math.min(Math.abs(v) / SWIPE_THRESHOLD, 1.6)
  );

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
      {/* شريط جانبي متدرج ينحني مع الاقتباس */}
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
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.18, right: 0.18 }}
      style={{ x: dragX, rotate }}
      onDrag={() => setTriggered(false)}
      onDragEnd={handleDragEnd}
      initial={triggered ? { scale: 0.97 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
    >
      {/* وهج مرن يمتد من طرف الفقاعة مع السحب */}
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

      <div className={cn(bubbleClass, 'relative z-10')} dir='auto'>
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

      <div
        className={cn(
          'flex items-center gap-1 px-1 text-[11px] text-light-secondary dark:text-dark-secondary',
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
      </div>
    </motion.div>
  );
}
