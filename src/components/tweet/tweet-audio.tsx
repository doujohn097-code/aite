import { HeroIcon } from '@components/ui/hero-icon';
import { VoicePlayer } from '@components/messages/voice-player';
import type { TweetAudio } from '@lib/types/tweet';

type TweetAudioPlayerProps = {
  audio: TweetAudio;
};

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** بطاقة منشور صوتي جذابة — هوية مرئية مشابهة لتيليجرام/واتساب */
export function TweetAudioPlayer({
  audio
}: TweetAudioPlayerProps): JSX.Element {
  return (
    <div
      className='mt-2 flex flex-col gap-2 rounded-2xl border border-main-accent/25
                 bg-gradient-to-l from-main-accent/[0.08] to-main-accent/[0.02] p-3
                 transition-colors duration-200 hover:border-main-accent/40
                 dark:from-main-accent/[0.15] dark:to-main-accent/10'
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      role='presentation'
    >
      <div className='flex items-center justify-between gap-2'>
        <span className='flex items-center gap-1.5 text-xs font-bold text-main-accent'>
          <span className='flex h-6 w-6 items-center justify-center rounded-full bg-main-accent/15'>
            <HeroIcon className='h-3.5 w-3.5' iconName='MicrophoneIcon' />
          </span>
          تسجيل صوتي
        </span>
        <span
          className='rounded-full bg-main-accent/10 px-2 py-0.5 text-[11px]
                     font-semibold text-main-accent'
        >
          {formatDuration(audio.duration)}
        </span>
      </div>
      <VoicePlayer
        src={audio.src}
        duration={audio.duration}
        peaks={audio.peaks}
        compact
      />
    </div>
  );
}
