import { auth } from '@lib/firebase/app';
import { filenameFromMedia } from '@lib/media-download';

export async function downloadRemoteMedia(
  src: string,
  options?: { alt?: string | null; type?: string | null }
): Promise<boolean> {
  if (!src) return false;
  const filename = filenameFromMedia(src, options?.alt, options?.type);
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  const proxy = `/api/media/download?url=${encodeURIComponent(src)}&name=${encodeURIComponent(
    filename
  )}`;

  const response = await fetch(proxy, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) return false;

  const blob = await response.blob();
  if (!blob.size) return false;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
  return true;
}
