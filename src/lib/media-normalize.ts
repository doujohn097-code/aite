import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '@lib/firebase/app';

/**
 * Client-side repair for videos Android WebView cannot decode.
 *
 * The platform accepts raw phone uploads (HEVC / H.264 High@L5.2 / .mov /
 * non-faststart MP4). Desktop Chrome decodes most of them, but Android's
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
      const response = await fetch('/api/media/normalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ src })
      });
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
 * (exactly what happens for unsupported codecs on Android WebView), it
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
