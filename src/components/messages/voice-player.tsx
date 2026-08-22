import { useEffect, useMemo, useRef, useState } from 'react';
import cn from 'clsx';
import { HeroIcon } from '@components/ui/hero-icon';

type VoicePlayerProps = {
  src: string;
  duration: number;
  peaks: number[];
  isOwn?: boolean;
  compact?: boolean;
  /** موجة أطول وزر أكبر — لبطاقات المنشورات الصوتية */
  tall?: boolean;
};

function normalizePeaks(peaks: number[], count: number): number[] {
  const bars = Array.from(
    { length: count },
    (_, i) => peaks[Math.floor((i / count) * peaks.length)] ?? 0
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
  compact,
  tall
}: VoicePlayerProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);

  const SPEEDS = [1, 1.5, 2] as const;

  const cycleSpeed = (): void => {
    const next =
      SPEEDS[
        (SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length
      ];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  // Keep the waveform within its dedicated grid track: it never touches the
  // play button, timer or speed control on narrow chat bubbles.
  const barCount = compact ? 16 : tall ? 24 : 20;
  const bars = useMemo(
    () =>
      normalizePeaks(peaks?.length ? peaks : [0.4, 0.7, 1, 0.5, 0.8], barCount),
    [peaks, barCount]
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
      audio.playbackRate = speed;
      // قد يفشل play() إن أُوقف فورًا أو حُجب — لا نُظهر خطأً للمستخدم
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>): void => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      Math.max((event.clientX - rect.left) / rect.width, 0),
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
        'grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-2xl',
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
          'flex shrink-0 items-center justify-center rounded-full transition active:scale-90',
          tall ? 'h-11 w-11' : 'h-9 w-9',
          isOwn
            ? 'bg-black/15 text-black hover:bg-black/25'
            : 'bg-main-accent text-black hover:brightness-90'
        )}
      >
        <HeroIcon
          className={tall ? 'h-6 w-6' : 'h-5 w-5'}
          iconName={playing ? 'PauseIcon' : 'PlayIcon'}
          solid
        />
      </button>
      <div
        className={cn(
          'flex min-w-[96px] cursor-pointer items-center justify-between gap-px overflow-hidden rounded-lg px-1',
          tall ? 'h-11' : 'h-8'
        )}
        onClick={seek}
        role='presentation'
      >
        {bars.map((height, index) => {
          const played = index / bars.length <= progress;
          return (
            <span
              key={index}
              className={cn(
                'w-0.5 shrink-0 rounded-full transition-[height,background-color] duration-150',
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
      <div className='flex shrink-0 items-center gap-1'>
        <span
          className={cn(
            'min-w-[2.25rem] text-left text-xs tabular-nums',
            isOwn
              ? 'text-black/70'
              : 'text-light-secondary dark:text-dark-secondary'
          )}
        >
          {formatDuration(
            playing || progress > 0 ? duration - current : duration
          )}
        </span>
        <button
          type='button'
          aria-label='سرعة التشغيل'
          onClick={cycleSpeed}
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums transition active:scale-90',
            speed === 1
              ? isOwn
                ? 'text-black/50'
                : 'text-light-secondary/60 dark:text-dark-secondary/60'
              : isOwn
              ? 'bg-black/15 text-black'
              : 'bg-main-accent/15 text-main-accent'
          )}
        >
          {speed}×
        </button>
      </div>
    </div>
  );
}
