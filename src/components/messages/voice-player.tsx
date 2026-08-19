import { useEffect, useMemo, useRef, useState } from 'react';
import cn from 'clsx';
import { HeroIcon } from '@components/ui/hero-icon';

type VoicePlayerProps = {
  src: string;
  duration: number;
  peaks: number[];
  isOwn?: boolean;
  compact?: boolean;
};

const BAR_COUNT = 30;

function normalizePeaks(peaks: number[]): number[] {
  const bars = Array.from(
    { length: BAR_COUNT },
    (_, i) => peaks[Math.floor((i / BAR_COUNT) * peaks.length)] ?? 0
  );
  const max = Math.max(...bars, 0.01);
  return bars.map((bar) => Math.max(bar / max, 0.12));
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VoicePlayer({
  src,
  duration,
  peaks,
  isOwn,
  compact
}: VoicePlayerProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const bars = useMemo(
    () => normalizePeaks(peaks?.length ? peaks : [0.4, 0.7, 1, 0.5, 0.8]),
    [peaks]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTime = (): void => {
      const total = audio.duration || duration || 1;
      setProgress(audio.currentTime / total);
    };
    const handleEnd = (): void => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('ended', handleEnd);
    return () => {
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('ended', handleEnd);
    };
  }, [duration]);

  const togglePlay = (): void => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>): void => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      Math.max((rect.right - event.clientX) / rect.width, 0),
      1
    );
    const total = audio.duration || duration || 0;
    if (total) audio.currentTime = ratio * total;
    setProgress(ratio);
  };

  const current = progress * (duration || 0);

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 overflow-visible',
        compact ? 'w-full' : 'w-52 xs:w-56'
      )}
      dir='ltr'
    >
      <audio ref={audioRef} src={src} preload='metadata' />
      <button
        type='button'
        aria-label={playing ? 'إيقاف' : 'تشغيل'}
        onClick={togglePlay}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90',
          isOwn
            ? 'bg-black/15 text-black hover:bg-black/25'
            : 'bg-main-accent text-black hover:brightness-90'
        )}
      >
        <HeroIcon
          className='h-5 w-5'
          iconName={playing ? 'PauseIcon' : 'PlayIcon'}
          solid
        />
      </button>
      <div
        className='flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-[2px]'
        onClick={seek}
        role='presentation'
      >
        {bars.map((height, index) => {
          const played = index / BAR_COUNT <= progress;
          return (
            <span
              key={index}
              className={cn(
                'w-[3px] shrink-0 rounded-full transition-colors duration-150',
                isOwn
                  ? played
                    ? 'bg-black'
                    : 'bg-black/30'
                  : played
                  ? 'bg-main-accent'
                  : 'bg-light-secondary/40 dark:bg-dark-secondary/50'
              )}
              style={{ height: `${Math.round(height * 100)}%` }}
            />
          );
        })}
      </div>
      <span
        className={cn(
          'w-auto min-w-[2.25rem] shrink-0 text-left text-xs tabular-nums',
          isOwn
            ? 'text-black/70'
            : 'text-light-secondary dark:text-dark-secondary'
        )}
      >
        {formatDuration(
          playing || progress > 0 ? duration - current : duration
        )}
      </span>
    </div>
  );
}
