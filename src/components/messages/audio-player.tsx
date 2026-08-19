import { useEffect, useRef, useState } from 'react';
import { HeroIcon } from '@components/ui/hero-icon';

type AudioPlayerProps = {
  src: string;
  duration?: number;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ src, duration: durationProp }: AudioPlayerProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationProp && durationProp > 0 ? durationProp : 0);

  useEffect(() => {
    if (durationProp && durationProp > 0) setDuration(durationProp);
  }, [durationProp]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = (): void => setCurrentTime(audio.currentTime);
    const updateDuration = (): void => {
      if (audio.duration && Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = (): void => setPlaying(false);
    const onPlay = (): void => setPlaying(true);
    const onPause = (): void => setPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    void audio.load();

    return (): void => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [src]);

  useEffect(() => {
    if (!playing) return;
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const bars = barsRef.current;
    const barCount = bars.length;

    const step = (): void => {
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < barCount; i++) {
        const bar = bars[i];
        if (!bar) continue;
        const start = Math.floor((i * data.length) / barCount);
        const end = Math.floor(((i + 1) * data.length) / barCount);
        let sum = 0;
        for (let j = start; j < end; j++) sum += data[j];
        const avg = sum / (end - start || 1);
        const height = Math.max(4, (avg / 255) * 32);
        bar.style.height = `${height}px`;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return (): void => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      bars.forEach((bar) => {
        if (bar) bar.style.height = '8px';
      });
    };
  }, [playing]);

  const togglePlay = async (): Promise<void> => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      return;
    }

    try {
      if (!audioCtxRef.current) {
        const AC =
          typeof window !== 'undefined' &&
          (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext);
        if (AC) {
          audioCtxRef.current = new AC();
          analyserRef.current = audioCtxRef.current.createAnalyser();
          analyserRef.current.fftSize = 64;
          sourceRef.current = audioCtxRef.current.createMediaElementSource(audio);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioCtxRef.current.destination);
        }
      }
      await audioCtxRef.current?.resume();
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  const bars = 24;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progress = safeDuration ? currentTime / safeDuration : 0;
  const activeBars = Math.max(0, Math.min(bars, Math.floor(progress * bars)));

  return (
    <div
      className='flex w-full min-w-0 items-center gap-3 rounded-2xl border border-white/20
                 bg-black/30 px-3 py-2.5 shadow-inner backdrop-blur-xl'
    >
      <audio ref={audioRef} src={src} preload='metadata' crossOrigin='anonymous' className='hidden' />
      <button
        type='button'
        onClick={() => void togglePlay()}
        className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                   bg-main-accent text-black shadow-lg transition hover:brightness-110 active:scale-95'
      >
        <HeroIcon iconName={playing ? 'PauseIcon' : 'PlayIcon'} className='h-4 w-4' />
      </button>
      <div className='flex min-w-0 flex-1 items-end gap-1 overflow-hidden'>
        {Array.from({ length: bars }).map((_, i) => {
          const isActive = i < activeBars;
          return (
            <div
              key={i}
              ref={(el): void => {
                barsRef.current[i] = el;
              }}
              className={`w-1.5 rounded-full transition-all ${
                isActive
                  ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]'
                  : 'bg-white/30'
              }`}
            />
          );
        })}
      </div>
      <span className='shrink-0 whitespace-nowrap text-xs font-medium opacity-90' dir='ltr'>
        <bdi>{formatTime(currentTime)}</bdi> / <bdi>{formatTime(safeDuration)}</bdi>
      </span>
    </div>
  );
}
