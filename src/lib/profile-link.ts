import {
  resolveProfileName,
  resolveUsername,
  visibleProfileName
} from './utils';
import type { SharedPostRef } from './types/message';
import type { User } from './types/user';

const PROFILE_HANDLE = /^[a-zA-Z0-9_]{3,30}$/;
const USER_PATH = /^\/user\/([a-zA-Z0-9_]{3,30})(?:\/|$)/i;

function firstNonEmptyLine(value: string): string {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  );
}

/** يستخرج اسم المستخدم أو المعرّف من مسار /user/... فقط. */
export function extractProfileHandleFromPath(pathname: string): string | null {
  const match = pathname.match(USER_PATH);
  if (!match) return null;
  const handle = match[1].toLowerCase();
  return PROFILE_HANDLE.test(handle) ? handle : null;
}

/**
 * يستخرج معرف الملف الشخصي من رابط كامل أو مسار داخلي.
 * يقبل أصول التطبيق الحالية والقديمة ومعاينات Vercel.
 */
export function extractProfileHandle(raw: string): string | null {
  const text = firstNonEmptyLine(raw);
  if (!text || text.length > 2048) return null;

  if (text.startsWith('/user/'))
    return extractProfileHandleFromPath(text.split(/[?#]/, 1)[0] ?? text);

  const candidate = /^(https?:\/\/|www\.)/i.test(text)
    ? /^https?:\/\//i.test(text)
      ? text
      : `https://${text}`
    : text.includes('/')
    ? `https://${text.replace(/^\/+/, '')}`
    : '';

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return extractProfileHandleFromPath(url.pathname);
  } catch {
    return null;
  }
}

/** الرسالة كلها مجرد رابط ملف شخصي (بدون نص إضافي). */
export function extractBareProfileHandle(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  return extractProfileHandle(trimmed);
}

export function toSharedProfile(user: User): SharedPostRef {
  const username = resolveUsername(user);
  return {
    id: user.id,
    kind: 'profile',
    authorName:
      (visibleProfileName(user.name) ?? resolveProfileName(user)) || null,
    authorUsername: username,
    authorPhoto: user.photoURL || null,
    text: user.bio?.trim() || null,
    thumbnail: user.coverPhotoURL || null,
    verified: !!user.verified,
    followers: user.followers?.length ?? 0
  };
}
