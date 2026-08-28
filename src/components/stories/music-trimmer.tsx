import { useEffect, useMemo, useRef, useState } from 'react';
import cn from 'clsx';
import { HeroIcon } from '@components/ui/hero-icon';
import { useLanguage } from '@lib/context/language-context';

const CLIP_SECONDS = 15;
const BAR_COUNT = 80;

type MusicTrimmerProps = {
  src: string;
  name: string;
  start: number;
  /** الطول الكامل للأغنية بالثواني (من نتائج البحث) — للعرض فقط */
  fullDuration?: number | null;
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
    const wave = Math.sin((i / BAR_COUNT) * Math.PI * 5) * 0.22 + 0.55;
    bars.push(Math.min(1, Math.max(0.16, wave * (0.6 + random * 0.8))));
  }

  return bars;
}

/**
 * شريط اقتصاص موسيقي بأسلوب إنستغرام:
 * الموجة تمثّل المقطع الصوتي كاملًا، ونافذة 15 ثانية تُسحب فوقه
 * مع تشغيل صوتي حيّ يتبع موضع الإصبع أثناء السحب.
 */
export function MusicTrimmer({
  src,
  name,
  start,
  fullDuration,
  onChange,
  onRemove
}: MusicTrimmerProps): JSX.Element {
  const { t } = useLanguage();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offset: number } | null>(null);
  const seekRef = useRef(0);

  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const bars = useMemo(() => buildWaveform(src), [src]);

  const clip = Math.min(CLIP_SECONDS, duration || CLIP_SECONDS);
  const maxStart = Math.max(0, (duration || CLIP_SECONDS) - clip);
  const windowRatio = duration ? clip / duration : 1;
  const startRatio = duration ? start / duration : 0;

  /* تحميل الصوت وقراءة مدّته الحقيقية */
  useEffect(() => {
    const audio = new Audio();
    audio.src = src;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const onMeta = (): void => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };

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
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('timeupdate', onTime);

    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

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

  /** معاينة حيّة: الصوت يقفز إلى موضع الإصبع أثناء السحب */
  const liveSeek = (nextStart: number): void => {
    const audio = audioRef.current;
    if (!audio) return;

    const now = Date.now();
    if (now - seekRef.current < 90) return;
    seekRef.current = now;

    audio.currentTime = nextStart;

    if (audio.paused)
      void audio.play().then(
        () => setPlaying(true),
        () => undefined
      );
  };

  const commitFromClientX = (
    clientX: number,
    grabOffset: number,
    seek = true
  ): void => {
    const track = trackRef.current;
    if (!track || !duration) return;

    const { left, width } = track.getBoundingClientRect();
    const windowWidth = width * windowRatio;

    const rawLeft = clientX - left - grabOffset;
    const clampedLeft = Math.max(0, Math.min(width - windowWidth, rawLeft));

    const nextStart = Math.max(
      0,
      Math.min(maxStart, (clampedLeft / width) * duration)
    );

    onChange(nextStart);
    if (seek) liveSeek(nextStart);
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
    setScrubbing(true);

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
    setScrubbing(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className='flex flex-col gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10'>
      <div className='flex items-center gap-3'>
        <button
          type='button'
          onClick={togglePreview}
          aria-label={
            playing ? t('music.pausePreview') : t('music.clipPreview')
          }
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
            {duration ? ` من ${formatTime(duration)}` : ''}
            {fullDuration && duration && fullDuration > duration + 2
              ? ` (الأغنية ${formatTime(fullDuration)})`
              : ''}
          </p>
        </div>
        <button
          type='button'
          onClick={onRemove}
          aria-label={t('music.remove')}
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
        className={cn(
          `relative h-20 w-full touch-none select-none overflow-hidden rounded-xl
           bg-black/40 transition-shadow`,
          scrubbing ? 'cursor-grabbing ring-2 ring-white/40' : 'cursor-grab'
        )}
        role='slider'
        aria-label={t('music.pick15')}
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
        {/* الموجة الكاملة */}
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
                  inWindow ? 'bg-white' : 'bg-white/20'
                )}
                style={{ height: `${Math.round(height * 100)}%` }}
              />
            );
          })}
        </div>

        {/* نافذة الاختيار */}
        <div
          className='pointer-events-none absolute inset-y-0 rounded-xl border-2 border-white
                     shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]'
          style={{
            left: `${startRatio * 100}%`,
            width: `${windowRatio * 100}%`
          }}
        >
          <span className='absolute inset-y-3 left-1 w-1 rounded-full bg-white/90' />
          <span className='absolute inset-y-3 right-1 w-1 rounded-full bg-white/90' />
          {playing && (
            <span
              className='absolute inset-y-0 w-0.5 bg-main-accent'
              style={{ left: `${progress * 100}%` }}
            />
          )}
          <span
            className='absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-full rounded-t-md
                       bg-white px-1.5 text-[10px] font-bold text-black'
          >
            15s
          </span>
        </div>
      </div>

      <p className='text-center text-[11px] text-white/50'>
        {t('music.dragHint')}
      </p>
    </div>
  );
}
