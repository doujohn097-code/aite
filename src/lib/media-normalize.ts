import { useCallback, useEffect, useRef, useState } from 'react';
import { transcodeVideo } from './client-transcode';

/**
 * إصلاح الفيديوهات التي لا تشتغل على بعض الأجهزة — محلياً داخل المتصفح.
 *
 * المنصة تقبل رفعات خام من الهاتف (HEVC / H.264 High@L5.2 / .mov / mp4 بدون
 * faststart). سطح المكتب يشغّل معظمها، لكن عارض الويب داخل تطبيق أندرويد
 * يعتمد كوادركودر الجهاز الذي يتوقف عند H.264 مستوى 4.x — فيظهر الفيديو
 * كمربع رمادي.
 *
 * كان الإصلاح يتم عبر /api/media/normalize (ffmpeg على الخادم)، والآن يتم
 * في المتصفح عبر MediaRecorder عند الحاجة، والنتيجة تُخزّن في ذاكرة الجلسة.
 */

const memoryCache = new Map<string, Promise<string | null>>();

export async function normalizeVideo(src: string): Promise<string | null> {
  if (!src || typeof src !== 'string') return null;
  const cached = memoryCache.get(src);
  if (cached) return cached;

  const task = (async (): Promise<string | null> => {
    try {
      const response = await fetch(src, { mode: 'cors' });
      if (!response.ok) return null;
      const blob = await response.blob();
      const result = await transcodeVideo(blob, { maxDurationSec: 10 * 60 });
      if (!result) return null;
      return URL.createObjectURL(result.blob);
    } catch {
      return null;
    }
  })();

  memoryCache.set(src, task);
  return task;
}

/** True when a URL points at a video file rather than a static image. */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|m4v|mov|webm|mkv|3gp|avi|ogv)([?#]|$)/i.test(url);
}

const posterCache = new Map<string, Promise<string | null>>();

/** يلتقط إطاراً من بداية الفيديو محلياً (canvas) ويعيده كرابط blob. */
export async function getVideoPoster(src: string): Promise<string | null> {
  if (!src || !isVideoUrl(src)) return null;
  const cached = posterCache.get(src);
  if (cached) return cached;

  const task = (async (): Promise<string | null> => {
    const video = document.createElement('video');
    let objectUrl: string | null = null;
    try {
      const response = await fetch(src, { mode: 'cors' });
      if (!response.ok) return null;
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      video.src = objectUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error('timeout')),
          20_000
        );
        const ok = (): void => {
          window.clearTimeout(timer);
          resolve();
        };
        const fail = (): void => {
          window.clearTimeout(timer);
          reject(new Error('error'));
        };
        video.addEventListener('loadeddata', ok, { once: true });
        video.addEventListener('error', fail, { once: true });
      });

      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) return null;
      video.currentTime = Math.min(0.6, duration / 2);
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error('timeout')),
          10_000
        );
        const ok = (): void => {
          window.clearTimeout(timer);
          resolve();
        };
        video.addEventListener('seeked', ok, { once: true });
        video.addEventListener('error', ok, { once: true });
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (canvas.width <= 0 || canvas.height <= 0) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const posterBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.82)
      );
      if (!posterBlob) return null;
      return URL.createObjectURL(posterBlob);
    } catch {
      return null;
    } finally {
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* لا شيء */
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  })();

  posterCache.set(src, task);
  return task;
}

/**
 * Poster for a video element: uses the existing thumbnail when it is a real
 * image, otherwise extracts a frame from the video locally.
 */
export function useVideoPoster(
  videoSrc: string,
  existingPoster?: string | null
): string | null {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!videoSrc) {
      setPoster(null);
      return;
    }
    if (existingPoster && !isVideoUrl(existingPoster)) {
      setPoster(existingPoster);
      return;
    }
    setPoster(null);
    void getVideoPoster(videoSrc).then((p) => {
      if (!cancelled) setPoster(p);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-line react-hooks/exhaustive-deps
  }, [videoSrc, existingPoster]);

  return poster;
}

export type RepairableVideo = {
  effectiveSrc: string;
  repairing: boolean;
  onError: () => void;
};

/** يبدّل مصدر الفيديو بنسخة مرمّزة محلياً عند فشل تشغيل الأصل. */
export function useRepairableVideo(src: string): RepairableVideo {
  const [effectiveSrc, setEffectiveSrc] = useState(src);
  const [repairing, setRepairing] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    setEffectiveSrc(src);
    tried.current = false;
    setRepairing(false);
  }, [src]);

  const onError = useCallback(() => {
    if (tried.current || !src) return;
    tried.current = true;
    setRepairing(true);
    void normalizeVideo(src).then((fixed) => {
      if (fixed) setEffectiveSrc(fixed);
      setRepairing(false);
    });
  }, [src]);

  return { effectiveSrc, repairing, onError };
}
