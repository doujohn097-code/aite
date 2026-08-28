export const MEBIBYTE = 1024 * 1024;

export const MAX_IMAGE_UPLOAD_BYTES = 20 * MEBIBYTE;
export const MAX_VIDEO_UPLOAD_BYTES = 100 * MEBIBYTE;
export const MAX_AUDIO_UPLOAD_BYTES = 25 * MEBIBYTE;
export const MAX_VOICE_DURATION_SECONDS = 10 * 60;
/** صور/فيديو المنشور الواحد */
export const POST_MEDIA_MAX = 10;
/** طلب الرفع قد يشمل بوستر لكل فيديو */
export const UPLOAD_FILES_MAX = POST_MEDIA_MAX * 2;

export function normalizeMediaType(type: string): string {
  return type.split(';', 1)[0].trim().toLowerCase();
}

export function inferMediaType(name: string, declaredType: string): string {
  const normalized = normalizeMediaType(declaredType);
  if (
    normalized.startsWith('image/') ||
    normalized.startsWith('video/') ||
    normalized.startsWith('audio/')
  )
    return normalized;

  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const inferred: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    '3gp': 'video/3gpp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    opus: 'audio/opus'
  };
  return inferred[extension] ?? normalized;
}

export function maxUploadBytesForType(type: string): number {
  const mime = normalizeMediaType(type);
  if (mime.startsWith('video/')) return MAX_VIDEO_UPLOAD_BYTES;
  if (mime.startsWith('audio/')) return MAX_AUDIO_UPLOAD_BYTES;
  return MAX_IMAGE_UPLOAD_BYTES;
}

export function uploadTimeoutMs(size: number): number {
  // Give slow mobile networks roughly one minute per 8 MiB, with a sensible
  // floor and a 15-minute ceiling. R2 receives the file directly, not Vercel.
  const estimated = 120_000 + Math.ceil(size / (8 * MEBIBYTE)) * 60_000;
  return Math.min(Math.max(estimated, 180_000), 15 * 60_000);
}

export function formatFileSize(bytes: number): string {
  if (bytes < MEBIBYTE) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  return `${Math.ceil(bytes / MEBIBYTE)} MB`;
}
