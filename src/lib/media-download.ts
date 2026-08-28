const DEFAULT_ALLOWED_HOST_SUFFIXES = ['.r2.dev', '.r2.cloudflarestorage.com'];

function hostnameOf(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extraAllowedDownloadHosts(): string[] {
  const hosts: string[] = [];
  const candidates = [
    process.env.R2_PUBLIC_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
  ];
  for (const candidate of candidates) {
    const host = candidate ? hostnameOf(candidate) : null;
    if (host) hosts.push(host);
  }
  return hosts;
}

export function isAllowedMediaDownloadUrl(value: string): boolean {
  if (!value || value.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return false;

  const extras = extraAllowedDownloadHosts();
  if (extras.includes(host)) return true;
  return DEFAULT_ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
  );
}

type AndroidAppFlags = {
  capacitor?: boolean;
  aiteBridge?: boolean;
};

function readCapacitorAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  const capacitor = (
    window as Window & {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        getPlatform?: () => string;
      };
    }
  ).Capacitor;
  if (!capacitor) return false;
  if (typeof capacitor.getPlatform === 'function') {
    return capacitor.getPlatform() === 'android';
  }
  return (
    typeof capacitor.isNativePlatform === 'function' &&
    capacitor.isNativePlatform() &&
    /Android/i.test(navigator.userAgent || '')
  );
}

export function isEmbeddedAndroidApp(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  flags?: AndroidAppFlags
): boolean {
  if (flags?.capacitor === true) return true;
  if (flags?.aiteBridge === true) return /Android/i.test(userAgent);
  if (readCapacitorAndroid()) return true;
  if (
    typeof window !== 'undefined' &&
    ((window as Window & { AiteAndroid?: unknown }).AiteAndroid ||
      (window as Window & { AiteUpdate?: unknown }).AiteUpdate) &&
    /Android/i.test(userAgent)
  ) {
    return true;
  }
  return /Android/i.test(userAgent) && /;\s*wv\)/i.test(userAgent);
}

export function isOutsideAppHost(
  targetUrl: string,
  appHost = typeof window === 'undefined' ? '' : window.location.hostname
): boolean {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    return Boolean(host) && host !== appHost.toLowerCase();
  } catch {
    return false;
  }
}

export function r2ObjectKeyFromPublicUrl(
  src: string,
  options?: { publicBase?: string; bucket?: string }
): string | null {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    const publicHost = options?.publicBase
      ? hostnameOf(options.publicBase)
      : null;
    const isR2 =
      host.endsWith('.r2.dev') ||
      host.endsWith('.r2.cloudflarestorage.com') ||
      Boolean(publicHost && host === publicHost);
    if (!isR2) return null;

    let key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const bucket = options?.bucket?.replace(/^\/+|\/+$/g, '');
    if (
      bucket &&
      host.endsWith('.r2.cloudflarestorage.com') &&
      key.startsWith(`${bucket}/`)
    ) {
      key = key.slice(bucket.length + 1);
    }
    return key || null;
  } catch {
    return null;
  }
}

export function filenameFromMedia(
  src: string,
  alt?: string | null,
  type?: string | null
): string {
  const rawName = (alt || '').split(/[/\\]/).pop()?.trim() ?? '';
  const cleaned = rawName.replace(/[^\w.\u0600-\u06FF-]+/g, '_').slice(0, 80);
  const fromUrl = (() => {
    try {
      const path = new URL(src).pathname;
      return path.split('/').pop() || '';
    } catch {
      return '';
    }
  })();
  const urlName = fromUrl.replace(/[^\w.-]+/g, '_').slice(0, 80);
  const base =
    (cleaned && cleaned !== '_' ? cleaned : '') ||
    (urlName && urlName !== '_' ? urlName : '') ||
    (type?.includes('video') ? 'aite-video' : 'aite-image');

  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const ext = type?.includes('video')
    ? 'mp4'
    : type?.includes('png')
    ? 'png'
    : type?.includes('gif')
    ? 'gif'
    : type?.includes('webp')
    ? 'webp'
    : type?.includes('jpeg') || type?.includes('jpg')
    ? 'jpg'
    : 'jpg';
  return `${base}.${ext}`;
}
