import { useEffect, useMemo, useRef, useState } from 'react';
import cn from 'clsx';
import { HeroIcon } from '@components/ui/hero-icon';

const CLIP_SECONDS = 15;
const BAR_COUNT = 64;

type MusicTrimmerProps = {
  src: string;
  name: string;
  start: number;
  onChange: (start: number) => void;
  onRemove: () => void;
};

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** موجة ثابتة مشتقّة من الرابط حتى تبقى نفس الأعمدة لنفس المقطع */
function buildWaveform(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

  const bars: number[] = [];

  for (let i = 0; i < BAR_COUNT; i += 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const random = (hash % 1000) / 1000;
    const wave = Math.sin((i / BAR_COUNT) * Math.PI * 4) * 0.25 + 0.55;
    bars.push(Math.min(1, Math.max(0.18, wave * (0.65 + random * 0.7))));
  }

  return bars;
}

/**
 * شريط اقتصاص موسيقي بأسلوب إنستغرام:
 * نافذة 15 ثانية قابلة للسحب فوق موجة المقطع مع معاينة صوتية فورية.
 */
export function MusicTrimmer({
  src,
  name,
  start,
  onChange,
  onRemove
}: MusicTrimmerProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offset: number } | null>(null);

  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const bars = useMemo(() => buildWaveform(src), [src]);

  const clip = Math.min(CLIP_SECONDS, duration || CLIP_SECONDS);
  const maxStart = Math.max(0, (duration || CLIP_SECONDS) - clip);
  const windowRatio = duration ? clip / duration : 1;
  const startRatio = duration ? start / duration : 0;

  /* تحميل المقطع لقراءة المدة */
  useEffect(() => {
    const audio = new Audio();
    audio.src = src;
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const onMeta = (): void => setDuration(audio.duration || 0);
    const onTime = (): void => {
      const elapsed = audio.currentTime - start;

      if (elapsed >= clip) {
        audio.currentTime = start;
        setProgress(0);
        return;
      }

      setProgress(Math.max(0, Math.min(1, elapsed / clip)));
    };

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);

    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  /* إيقاف المعاينة عند تغيير نقطة البداية */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - start) > clip) audio.currentTime = start;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const togglePreview = (): void => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    audio.currentTime = start;
    void audio.play().then(
      () => setPlaying(true),
      () => setPlaying(false)
    );
  };

  const commitFromClientX = (clientX: number, grabOffset: number): void => {
    const track = trackRef.current;
    if (!track || !duration) return;

    const { left, width } = track.getBoundingClientRect();
    const windowWidth = width * windowRatio;

    // في RTL يبقى المحور الأفقي كما هو لأن الشريط يُرسم LTR
    const rawLeft = clientX - left - grabOffset;
    const clampedLeft = Math.max(0, Math.min(width - windowWidth, rawLeft));

    const nextStart = (clampedLeft / width) * duration;

    onChange(Math.max(0, Math.min(maxStart, nextStart)));
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ): void => {
    const track = trackRef.current;
    if (!track || !duration) return;

    const { left, width } = track.getBoundingClientRect();
    const windowWidth = width * windowRatio;
    const windowLeft = width * startRatio;
    const pointerX = event.clientX - left;

    const insideWindow =
      pointerX >= windowLeft && pointerX <= windowLeft + windowWidth;

    const grabOffset = insideWindow ? pointerX - windowLeft : windowWidth / 2;

    dragRef.current = { pointerId: event.pointerId, offset: grabOffset };
    event.currentTarget.setPointerCapture(event.pointerId);

    commitFromClientX(event.clientX, grabOffset);
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    commitFromClientX(event.clientX, drag.offset);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className='flex flex-col gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10'>
      <div className='flex items-center gap-3'>
        <button
          type='button'
          onClick={togglePreview}
          aria-label={playing ? 'إيقاف المعاينة' : 'معاينة المقطع'}
          className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                     bg-white text-black transition active:scale-90'
        >
          <HeroIcon
            className='h-5 w-5'
            iconName={playing ? 'PauseIcon' : 'PlayIcon'}
            solid
          />
        </button>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-bold text-white'>{name}</p>
          <p className='text-[11px] text-white/60'>
            {formatTime(start)} — {formatTime(start + clip)} ·{' '}
            {Math.round(clip)} ثانية
          </p>
        </div>
        <button
          type='button'
          onClick={onRemove}
          aria-label='إزالة الموسيقى'
          className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                     bg-white/10 text-white transition hover:bg-white/20 active:scale-90'
        >
          <HeroIcon className='h-4 w-4' iconName='XMarkIcon' />
        </button>
      </div>

      {/* الشريط */}
      <div
        ref={trackRef}
        dir='ltr'
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className='relative h-16 w-full cursor-grab touch-none select-none overflow-hidden
                   rounded-xl bg-black/40 active:cursor-grabbing'
        role='slider'
        aria-label='اختيار 15 ثانية من المقطع'
        aria-valuemin={0}
        aria-valuemax={Math.round(maxStart)}
        aria-valuenow={Math.round(start)}
        tabIndex={0}
        onKeyDown={(event): void => {
          if (event.key === 'ArrowLeft') onChange(Math.max(0, start - 1));
          else if (event.key === 'ArrowRight')
            onChange(Math.min(maxStart, start + 1));
        }}
      >
        {/* الموجة */}
        <div className='absolute inset-0 flex items-center justify-between gap-px px-1'>
          {bars.map((height, index) => {
            const barRatio = index / BAR_COUNT;
            const inWindow =
              barRatio >= startRatio && barRatio <= startRatio + windowRatio;

            return (
              <span
                key={index}
                className={cn(
                  'w-full rounded-full transition-colors duration-150',
                  inWindow ? 'bg-white' : 'bg-white/25'
                )}
                style={{ height: `${Math.round(height * 100)}%` }}
              />
            );
          })}
        </div>

        {/* نافذة الاختيار */}
        <div
          className='pointer-events-none absolute inset-y-0 rounded-xl border-2 border-white
                     shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]'
          style={{
            left: `${startRatio * 100}%`,
            width: `${windowRatio * 100}%`
          }}
        >
          <span className='absolute inset-y-2 left-1 w-1 rounded-full bg-white/90' />
          <span className='absolute inset-y-2 right-1 w-1 rounded-full bg-white/90' />
          {playing && (
            <span
              className='absolute inset-y-0 w-0.5 bg-main-accent'
              style={{ left: `${progress * 100}%` }}
            />
          )}
        </div>
      </div>

      <p className='text-center text-[11px] text-white/50'>
        اسحب الشريط لاختيار الـ15 ثانية التي تريدها
      </p>
    </div>
  );
}
