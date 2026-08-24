import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '@lib/firebase/app';

/**
 * Client-side repair for videos some mobile browsers cannot decode.
 *
 * The platform accepts raw phone uploads (HEVC / H.264 High@L5.2 / .mov /
 * non-faststart MP4). Desktop Chrome decodes most of them, but mobile browsers'
 * WebView relies on the device hardware decoder, which caps out at
 * H.264 level 4.1/4.2 — so the same video renders as a gray box in the app
 * while looking perfect on the web.
 *
 * `normalizeVideo` asks the server to re-encode the file into a universally
 * playable MP4 (H.264 High@L4.0, faststart, AAC) and returns the new URL.
 * Results are cached per session and persisted server-side, so a video is
 * only transcoded once.
 */

const memoryCache = new Map<string, Promise<string | null>>();

export async function normalizeVideo(src: string): Promise<string | null> {
  if (!src || typeof src !== 'string') return null;
  const cached = memoryCache.get(src);
  if (cached) return cached;

  const task = (async (): Promise<string | null> => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return null;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 55_000);
      const response = await fetch('/api/media/normalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ src }),
        signal: controller.signal
      }).finally(() => window.clearTimeout(timeout));
      if (!response.ok) return null;
      const data = (await response.json()) as { src?: string };
      if (!data.src || data.src === src) return null;
      return data.src;
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

/**
 * Requests a JPEG frame (near the beginning) of a video from the server so
 * previews can show a real picture of the video on every device.
 */
export async function getVideoPoster(src: string): Promise<string | null> {
  if (!src || !isVideoUrl(src)) return null;
  const cached = posterCache.get(src);
  if (cached) return cached;

  const task = (async (): Promise<string | null> => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return null;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 35_000);
      const response = await fetch('/api/media/poster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ src }),
        signal: controller.signal
      }).finally(() => window.clearTimeout(timeout));
      if (!response.ok) return null;
      const data = (await response.json()) as { src?: string };
      return data.src || null;
    } catch {
      return null;
    }
  })();

  posterCache.set(src, task);
  return task;
}

/**
 * Poster for a video element: uses the existing thumbnail when it is a real
 * image, otherwise asks the server to extract a frame from the video.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc, existingPoster]);

  return poster;
}

type RepairableVideo = {
  /** Src to render — the original until a repair swaps it for a fixed file. */
  effectiveSrc: string;
  /** True while the server is re-encoding the video. */
  repairing: boolean;
  /** Attach to the <video> element's onError. */
  onError: () => void;
};

/**
 * Hook for video elements: when the browser fails to load/decode a video
 * (exactly what happens for unsupported codecs on mobile browsers), it
 * requests a server-side re-encode and swaps the src once ready.
 */
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
