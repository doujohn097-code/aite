import { auth } from '@lib/firebase/app';
import {
  filenameFromMedia,
  isEmbeddedAndroidApp,
  isOutsideAppHost
} from '@lib/media-download';

export type MediaSaveResult = 'chrome' | boolean;

type NativeSaver = {
  saveMedia?: (url: string, filename: string) => unknown;
};

function nativeSave(url: string, filename: string): boolean {
  if (typeof window === 'undefined') return false;
  const android = (window as Window & { AiteAndroid?: NativeSaver })
    .AiteAndroid;
  const update = (window as Window & { AiteUpdate?: NativeSaver }).AiteUpdate;
  try {
    if (typeof android?.saveMedia === 'function') {
      android.saveMedia(url, filename);
      return true;
    }
    if (typeof update?.saveMedia === 'function') {
      update.saveMedia(url, filename);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://aite-app-one.vercel.app';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function openOutsideApp(httpsUrl: string): boolean {
  if (!isOutsideAppHost(httpsUrl)) return false;
  try {
    const link = document.createElement('a');
    link.href = httpsUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    // نكمل بتعيين العنوان
  }
  try {
    window.open(httpsUrl, '_blank', 'noopener,noreferrer');
  } catch {
    // بعض WebView تمنع النوافذ
  }
  try {
    window.location.assign(httpsUrl);
    return true;
  } catch {
    return false;
  }
}

function triggerAnchorDownload(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener';
  link.target = '_self';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function saveWithPicker(blob: Blob, filename: string): Promise<boolean> {
  const picker = (
    window as Window & {
      showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{
        createWritable: () => Promise<{
          write: (d: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;
  if (typeof picker !== 'function') return false;
  const handle = await picker({ suggestedName: filename });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}

async function shareFile(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, {
    type: blob.type || 'application/octet-stream'
  });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  if (!nav.share || (nav.canShare && !nav.canShare({ files: [file] })))
    return false;
  await nav.share({ files: [file], title: filename });
  return true;
}

export async function downloadRemoteMedia(
  src: string,
  options?: { alt?: string | null; type?: string | null }
): Promise<MediaSaveResult> {
  if (!src || typeof window === 'undefined') return false;
  const filename = filenameFromMedia(src, options?.alt, options?.type);
  const useChrome = isEmbeddedAndroidApp();

  if (!useChrome && nativeSave(src, filename)) return true;

  const token = await auth.currentUser?.getIdToken().catch(() => null);
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const ticketResponse = await fetch('/api/media/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({ url: src, name: filename })
  }).catch(() => null);

  if (ticketResponse?.ok) {
    const data = (await ticketResponse.json().catch(() => null)) as {
      ticket?: string;
      openUrl?: string | null;
    } | null;
    if (useChrome && data?.openUrl && openOutsideApp(data.openUrl)) {
      return 'chrome';
    }
    if (data?.ticket && !useChrome) {
      const ticketUrl = absoluteUrl(
        `/api/media/download?ticket=${encodeURIComponent(data.ticket)}`
      );
      const iframe = document.createElement('iframe');
      iframe.hidden = true;
      iframe.src = ticketUrl;
      document.body.appendChild(iframe);
      window.setTimeout(() => iframe.remove(), 60_000);
      return true;
    }
  }

  if (useChrome && isOutsideAppHost(src) && openOutsideApp(src)) {
    return 'chrome';
  }

  if (useChrome) return false;

  const proxy = `/api/media/download?url=${encodeURIComponent(
    src
  )}&name=${encodeURIComponent(filename)}`;
  const response = await fetch(proxy, { headers });
  if (!response.ok) return false;
  const blob = await response.blob();
  if (!blob.size) return false;

  try {
    if (await saveWithPicker(blob, filename)) return true;
  } catch {
    return false;
  }

  try {
    if (await shareFile(blob, filename)) return true;
  } catch {
    // ألغى المشاركة
  }

  const objectUrl = URL.createObjectURL(blob);
  triggerAnchorDownload(objectUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  return true;
}
