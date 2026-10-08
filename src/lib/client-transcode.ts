/**
 * ترميز الفيديو على جهاز المستخدم — بديل ffmpeg الخادمي.
 *
 * سبب الوجود: مسارا /api/media/normalize و /api/media/poster كانا يشغّلان
 * ffmpeg على الخادم (Vercel) لإعادة ترميز فيديوهات الهاتف الخام (HEVC /
 * H.264 بمستوى عالٍ / mov / mp4 بدون faststart) لأن كوادركودر بعض الأجهزة
 * لا يشغّلها. على Cloudflare Workers لا يمكن تشغيل برامج خارجية ولا حزم
 * ملفات بحجم ffmpeg، لذا انتقل الترميز إلى جهاز المستخدم نفسه عبر
 * MediaRecorder: الناتج MP4 (H.264) حيث يدعم المتصفح ذلك، وإلا WebM.
 */

type TranscodeMime = { mimeType: string; container: 'mp4' | 'webm' };

const MP4_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs="avc1.4D401E,mp4a.40.2"',
  'video/mp4;codecs="avc1,mp4a.40.2"',
  'video/mp4'
];

const WEBM_CANDIDATES = [
  'video/webm;codecs="vp9,opus"',
  'video/webm;codecs="vp8,opus"',
  'video/webm'
];

let cachedMime: TranscodeMime | null | undefined;

/** أفضل صيغة تسجيل يدعمها هذا المتصفح (يفضّل MP4/H.264 دائماً). */
export function pickRecorderMime(): TranscodeMime | null {
  if (cachedMime !== undefined) return cachedMime;
  cachedMime = null;
  try {
    if (
      typeof MediaRecorder === 'undefined' ||
      typeof MediaRecorder.isTypeSupported !== 'function'
    )
      return cachedMime;
    const firstSupported = (
      list: string[],
      container: 'mp4' | 'webm'
    ): TranscodeMime | null => {
      for (const mimeType of list) {
        try {
          if (MediaRecorder.isTypeSupported(mimeType))
            return { mimeType, container };
        } catch {
          /* تجاهل وجرّب التالي */
        }
      }
      return null;
    };
    cachedMime =
      firstSupported(MP4_CANDIDATES, 'mp4') ??
      firstSupported(WEBM_CANDIDATES, 'webm');
  } catch {
    cachedMime = null;
  }
  return cachedMime;
}

/** هل الصيغة الأصلية معروفة بمشاكل التشغيل على الأجهزة الأخرى؟ */
function isRiskyOriginal(type: string, name: string): boolean {
  return (
    /quicktime|3gpp|matroska|x-m4v/.test(type) ||
    /\.(mov|mkv|3gp|m4v|avi)$/.test(name) ||
    /hvc1|hev1|hevc|dvh/.test(type)
  );
}

/**
 * هل يجب ترميز هذا الملف قبل رفعه؟
 * - إن كان الناتج المتاح MP4: نرمّز كل الفيديو (عدا WebM) لضمان التوافق
 *   مع كل الأجهزة، لأن مستوى H.264 لا يمكن معرفته في المتصفح.
 * - إن كان الناتج المتاح WebM فقط: نرمّز الصيغ "المخطرة" حصراً، لأن تحويل
 *   mp4 سليم إلى webm يفقده التوافق مع iPhone.
 */
export function shouldTranscodeAtUpload(file: File): boolean {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined')
    return false;
  if (file.size <= 0) return false;
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  const isVideo =
    type.startsWith('video/') ||
    /\.(mp4|m4v|mov|mkv|3gp|avi|ogv)$/.test(name);
  if (!isVideo) return false;
  const picked = pickRecorderMime();
  if (!picked) return false;
  if (type === 'video/webm' || name.endsWith('.webm')) return false;
  if (picked.container === 'webm') return isRiskyOriginal(type, name);
  return true;
}

export type TranscodeResult = {
  blob: Blob;
  mime: string;
  container: 'mp4' | 'webm';
};

type VideoWithCapture = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
  webkitCaptureStream?: () => MediaStream;
};

function waitForEvent(
  target: HTMLVideoElement,
  event: string,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      target.removeEventListener(event, onOk);
      target.removeEventListener('error', onErr);
      reject(new Error(`wait_${event}_timeout`));
    }, timeoutMs);
    const onOk = (): void => {
      window.clearTimeout(timer);
      target.removeEventListener('error', onErr);
      resolve();
    };
    const onErr = (): void => {
      window.clearTimeout(timer);
      target.removeEventListener(event, onOk);
      reject(new Error('media_error'));
    };
    target.addEventListener(event, onOk, { once: true });
    target.addEventListener('error', onErr, { once: true });
  });
}

/**
 * يعيد ترميز الفيديو إلى صيغة قابلة للتشغيل عالمياً ويعيد النتيجة كـ Blob،
 * أو null إذا تعذّر الترميز (فيبقى الملف الأصلي هو المستخدم).
 */
export async function transcodeVideo(
  input: Blob,
  options?: {
    onProgress?: (percent: number) => void;
    maxDurationSec?: number;
  }
): Promise<TranscodeResult | null> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined')
    return null;
  const picked = pickRecorderMime();
  if (!picked) return null;

  const maxDurationSec = options?.maxDurationSec ?? 10 * 60;
  const objectUrl = URL.createObjectURL(input);
  const video = document.createElement('video') as VideoWithCapture;
  video.src = objectUrl;
  video.playsInline = true;
  video.preload = 'auto';
  video.muted = false;

  let audioContext: AudioContext | null = null;
  let cleanup = (): void => {
    try {
      video.pause();
    } catch {
      /* لا شيء */
    }
    video.removeAttribute('src');
    try {
      video.load();
    } catch {
      /* لا شيء */
    }
    if (audioContext) {
      try {
        void audioContext.close();
      } catch {
        /* لا شيء */
      }
      audioContext = null;
    }
    URL.revokeObjectURL(objectUrl);
    cleanup = (): void => undefined;
  };

  try {
    await waitForEvent(video, 'loadedmetadata', 20_000);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0 || duration > maxDurationSec) return null;
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

    const stream = new MediaStream();
    let drawStop: (() => void) | null = null;

    // المسار المفضل: التقاط مباشر من عنصر الفيديو (صورة + صوت)
    let captured: MediaStream | null = null;
    const elementCapture =
      video.captureStream ?? video.mozCaptureStream ?? video.webkitCaptureStream;
    if (elementCapture) {
      try {
        captured = elementCapture.call(video);
      } catch {
        captured = null;
      }
    }

    if (captured && captured.getVideoTracks().length > 0) {
      for (const track of captured.getTracks()) stream.addTrack(track);
    } else {
      // المسار البديل: رسم الإطارات على canvas والالتقاط منه
      const scale = Math.min(1, 1280 / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
      canvas.height = Math.max(
        2,
        Math.round((video.videoHeight * scale) / 2) * 2
      );
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const canvasStream = canvas.captureStream(30);
      for (const track of canvasStream.getTracks()) stream.addTrack(track);
      const draw = (): void => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          /* إطار ساقط */
        }
      };
      draw();
      const rvfcVideo = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
      };
      if (typeof rvfcVideo.requestVideoFrameCallback === 'function') {
        let stopped = false;
        const loop = (): void => {
          if (stopped) return;
          draw();
          rvfcVideo.requestVideoFrameCallback?.(loop);
        };
        rvfcVideo.requestVideoFrameCallback(loop);
        drawStop = (): void => {
          stopped = true;
        };
      } else {
        const timer = window.setInterval(draw, 1000 / 30);
        drawStop = (): void => {
          window.clearInterval(timer);
        };
      }
    }

    // إن لم يوجد مسار صوت، نستخرجه عبر WebAudio (المصدر عنصر الفيديو)
    if (stream.getAudioTracks().length === 0) {
      try {
        const AudioCtor =
          window.AudioContext ??
          (
            window as unknown as {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (AudioCtor) {
          audioContext = new AudioCtor();
          const source = audioContext.createMediaElementSource(video);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          for (const track of destination.stream.getAudioTracks())
            stream.addTrack(track);
        }
      } catch {
        /* فيديو بدون صوت — نكمل بالصورة فقط */
      }
    }

    const pixels = video.videoWidth * video.videoHeight;
    const videoBitsPerSecond =
      pixels >= 1280 * 720 ? 3_000_000 : pixels >= 640 * 360 ? 1_500_000 : 800_000;

    const recorder = new MediaRecorder(stream, {
      mimeType: picked.mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond: 128_000
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event): void => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = (): void =>
        resolve(
          new Blob(chunks, {
            type: picked.container === 'mp4' ? 'video/mp4' : 'video/webm'
          })
        );
      recorder.onerror = (): void => reject(new Error('recorder_error'));
    });

    const stopAll = (): void => {
      drawStop?.();
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        /* لا شيء */
      }
      try {
        video.pause();
      } catch {
        /* لا شيء */
      }
    };

    const onProgress = options?.onProgress;
    const reportProgress = (): void => {
      if (onProgress)
        onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
    };
    video.addEventListener('timeupdate', reportProgress);

    // قد يرفض المتصفح التشغيل بدون تفاعل مستخدم — عندها نرجع null ويستخدم
    // المستدعي الملف الأصلي.
    await video.play();
    recorder.start(1000);

    const ended = new Promise<void>((resolve) => {
      const done = (): void => resolve();
      video.addEventListener('ended', done, { once: true });
    });

    const timeoutMs = Math.min(duration * 1000 * 1.5 + 30_000, 15 * 60_000);
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      stopAll();
    }, timeoutMs);

    try {
      await ended;
    } finally {
      window.clearTimeout(timer);
      video.removeEventListener('timeupdate', reportProgress);
      stopAll();
    }

    const blob = await finished;
    if (timedOut || blob.size < 1024) return null;
    onProgress?.(100);
    return {
      blob,
      mime: picked.container === 'mp4' ? 'video/mp4' : 'video/webm',
      container: picked.container
    };
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

/**
 * يرمّز ملف الفيديو للرفع إن لزم، ويعيد ملفاً جديداً بنفس المعرف (id)
 * أو الملف الأصلي كما هو. لا يرمي استثناءات أبداً.
 */
export async function transcodeFileForUpload<
  T extends File & { id: string }
>(file: T, maxBytes: number): Promise<T> {
  if (!shouldTranscodeAtUpload(file)) return file;
  try {
    const result = await transcodeVideo(file);
    if (!result || result.blob.size <= 0) return file;
    // اقبل النسخة المرمّزة فقط إن بقيت ضمن حد الرفع ولم تتضخم بشكل جنوني
    const sizeCap = Math.max(file.size * 1.25, 3 * 1024 * 1024);
    if (result.blob.size > maxBytes || result.blob.size > sizeCap) return file;
    const ext = result.container === 'webm' ? 'webm' : 'mp4';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'video';
    const name = `${baseName}.${ext}`;
    const transcoded = new File([result.blob], name, {
      type: result.mime
    }) as T;
    transcoded.id = file.id;
    return transcoded;
  } catch {
    return file;
  }
}
