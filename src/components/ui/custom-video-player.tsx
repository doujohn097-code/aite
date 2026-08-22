import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { HeroIcon } from '@components/ui/hero-icon';
import { useRepairableVideo } from '@lib/media-normalize';
import type { IconName } from '@components/ui/hero-icon';

type CustomVideoPlayerProps = {
  src: string;
  className?: string;
  /** Rounded corners etc. passed through to the <video> element */
  videoClassName?: string;
  poster?: string | null;
  autoHideDelay?: number;
};

/**
 * Minimal custom video controls: big center play button and a slim
 * gradient bar that auto-hides during playback — the content is never
 * blocked by native browser chrome.
 */
export function CustomVideoPlayer({
  src,
  className,
  videoClassName,
  poster,
  autoHideDelay = 2500
}: CustomVideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Android WebView cannot decode some phone uploads; swap in a server-side
  // re-encoded copy when the original fails to load.
  const { effectiveSrc, repairing, onError } = useRepairableVideo(src);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const scheduleHide = (): void => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, autoHideDelay);
  };

  const wakeControls = (): void => {
    setShowControls(true);
    scheduleHide();
  };

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  const togglePlay = (): void => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // A user gesture — playing unmuted is allowed by autoplay policy
      video.muted = muted;
      void video.play().catch(() => null);
    } else video.pause();
  };

  const toggleMute = (): void => {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
    wakeControls();
  };

  const handleSeek = (value: number): void => {
    if (!videoRef.current || !duration) return;
    videoRef.current.currentTime = (value / 100) * duration;
    setProgress(value);
  };

  const handleFullscreen = (): void => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void video.requestFullscreen().catch(() => null);
  };

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => setProgress(0), [effectiveSrc]);

  const controlButton = (
    icon: IconName,
    label: string,
    onClick: () => void
  ): JSX.Element => (
    <button
      type='button'
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className='flex h-7 w-7 items-center justify-center rounded-full text-white
                 transition hover:bg-white/20 active:scale-90'
    >
      <HeroIcon className='h-4 w-4' iconName={icon} />
    </button>
  );

  return (
    <div
      className={cn('group relative overflow-hidden bg-black', className)}
      onMouseMove={wakeControls}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        wakeControls();
      }}
    >
      <video
        key={effectiveSrc}
        ref={videoRef}
        src={effectiveSrc}
        poster={poster ?? undefined}
        playsInline
        muted={muted}
        preload='metadata'
        className={cn('h-full w-full bg-transparent', videoClassName)}
        onError={onError}
        onPlay={() => {
          setPlaying(true);
          scheduleHide();
        }}
        onPause={() => {
          setPlaying(false);
          setShowControls(true);
        }}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (video && video.duration)
            setProgress((video.currentTime / video.duration) * 100);
        }}
        onEnded={() => {
          setPlaying(false);
          setShowControls(true);
        }}
      />

      {/* Repairing an unsupported video (Android WebView fallback) */}
      {repairing && (
        <div className='absolute inset-0 z-20 flex items-center justify-center bg-black/45'>
          <div className='flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur'>
            <HeroIcon
              className='h-4 w-4 animate-spin'
              iconName='ArrowPathIcon'
            />
            جاري إصلاح الفيديو…
          </div>
        </div>
      )}

      {/* Big center play button — only while paused */}
      <AnimatePresence>
        {!playing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.18 }}
            className='pointer-events-none absolute inset-0 flex items-center justify-center'
          >
            <div className='flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white shadow-2xl backdrop-blur-md'>
              <HeroIcon
                className='h-7 w-7 translate-x-0.5'
                iconName='PlayIcon'
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slim gradient control bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-6'
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className='flex items-center gap-2'>
              {controlButton(
                playing ? 'PauseIcon' : 'PlayIcon',
                playing ? 'إيقاف' : 'تشغيل',
                togglePlay
              )}
              <input
                type='range'
                min={0}
                max={100}
                step={0.1}
                value={progress}
                onChange={(e) => handleSeek(Number(e.target.value))}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label='التقدم'
                className='h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/30
                           accent-main-accent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-white'
              />
              <span className='min-w-[2.5rem] text-center text-[11px] tabular-nums text-white/90'>
                {formatTime(duration)}
              </span>
              {controlButton(
                muted ? 'SpeakerXMarkIcon' : 'SpeakerWaveIcon',
                muted ? 'تشغيل الصوت' : 'كتم الصوت',
                toggleMute
              )}
              {controlButton(
                'ArrowsPointingOutIcon',
                'ملء الشاشة',
                handleFullscreen
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
