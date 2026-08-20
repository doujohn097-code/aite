import { VoicePlayer } from '@components/messages/voice-player';
import type { TweetAudio } from '@lib/types/tweet';

type TweetAudioPlayerProps = {
  audio: TweetAudio;
};

/** مشغّل صوت مموّج داخل المنشور — نفس شكل الرسائل الصوتية */
export function TweetAudioPlayer({
  audio
}: TweetAudioPlayerProps): JSX.Element {
  return (
    <div
      className='mt-2 rounded-2xl border border-light-border bg-light-primary/5 p-3
                 dark:border-dark-border dark:bg-dark-primary/5'
      onClick={(e) => e.stopPropagation()}
    >
      <VoicePlayer
        src={audio.src}
        duration={audio.duration}
        peaks={audio.peaks}
      />
    </div>
  );
}
