import cn from 'clsx';
import { VoicePlayer } from './voice-player';
import { ImagePreview } from '@components/input/image-preview';
import { HeroIcon } from '@components/ui/hero-icon';
import type { Message } from '@lib/types/message';

type MessageBubbleProps = {
  message: Message;
  isOwn: boolean;
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
  isOwn
}: MessageBubbleProps): JSX.Element {
  const { type, text, media, audio, createdAt, seenBy } = message;
  const seen = seenBy?.length > 1;

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

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-1',
        isOwn ? 'items-end' : 'items-start'
      )}
    >
      <div className={bubbleClass} dir='auto'>
        {type === 'text' && (
          <p className='whitespace-pre-wrap break-words'>{text}</p>
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
            {text}
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
    </div>
  );
}
