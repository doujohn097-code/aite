import { tx } from './i18n/tx';
import type { SyntheticEvent } from 'react';
import type { MotionProps } from 'framer-motion';

export function preventBubbling(
  callback?: ((...args: never[]) => unknown) | null,
  noPreventDefault?: boolean
) {
  return (e: SyntheticEvent): unknown => {
    e.stopPropagation();

    if (!noPreventDefault) e.preventDefault();
    if (callback) return callback();
    return undefined;
  };
}

export function delayScroll(ms: number) {
  return (): NodeJS.Timeout => setTimeout(() => window.scrollTo(0, 0), ms);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** يغلّف وعدًا بمهلة زمنية — يمنع تعليق الواجهة إذا لم يكتمل الرفع أبدًا */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = tx('err.timeout')
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    )
  ]);
}

export function getStatsMove(movePixels: number): MotionProps {
  return {
    initial: {
      opacity: 0,
      y: -movePixels
    },
    animate: {
      opacity: 1,
      y: 0
    },
    exit: {
      opacity: 0,
      y: movePixels
    },
    transition: {
      type: 'tween',
      duration: 0.15
    }
  };
}

export function isPlural(count: number): string {
  return count > 1 ? 's' : '';
}

export function safeHttpUrl(raw: string): string | null {
  if (!raw || raw.length > 2048) return null;
  const trimmed = raw.trim();
  if (!/^(https?:\/\/|www\.)/i.test(trimmed)) return null;
  try {
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const ipv4 = host.split('.').map(Number);
    const privateIpv4 =
      ipv4.length === 4 &&
      ipv4.every(
        (part) => Number.isInteger(part) && part >= 0 && part <= 255
      ) &&
      (ipv4[0] === 0 ||
        ipv4[0] === 10 ||
        ipv4[0] === 127 ||
        (ipv4[0] === 169 && ipv4[1] === 254) ||
        (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) ||
        (ipv4[0] === 192 && ipv4[1] === 168));
    const privateIpv6 =
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80:');
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      privateIpv4 ||
      privateIpv6
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const decoded = decodeURIComponent(value);
    const hasControlCharacter = Array.from(decoded).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
    return (
      decoded.startsWith('/') &&
      !decoded.startsWith('//') &&
      !decoded.includes('\\') &&
      !hasControlCharacter
    );
  } catch {
    return false;
  }
}

export function withoutId<T extends { id: string }>(obj: T): Omit<T, 'id'> {
  const copy = { ...obj };
  delete (copy as Record<string, unknown>).id;
  return copy as Omit<T, 'id'>;
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function usernameToInternalEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  const local = base64UrlEncode(normalized).slice(0, 60);
  return `${local}@aite.local`;
}

/** يستعيد اسم المستخدم من البريد الداخلي الذي ينشئه Aite عند التسجيل. */
export function internalEmailToUsername(email?: string | null): string | null {
  if (!email) return null;

  const normalized = email.trim();
  if (!normalized.toLowerCase().endsWith('@aite.local')) return null;

  // Base64 is case-sensitive, so only the domain may be compared lowercase.
  const encoded = normalized.slice(0, -'@aite.local'.length);
  if (!encoded) return null;

  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0)
    );
    const username = new TextDecoder().decode(bytes).trim().toLowerCase();

    return /^[a-z0-9_]{3,15}$/i.test(username) ? username : null;
  } catch {
    return null;
  }
}

/** القيم التي كانت تُكتب سابقًا عند حدوث سباق أثناء إنشاء الحساب. */
export function isPlaceholderProfileName(value?: string | null): boolean {
  const name = value?.trim() ?? '';
  return (
    !name ||
    /^(?:مستخدم|مستحدم)(?:[\s_-]*\d+)?$/u.test(name) ||
    /^user(?:[\s_-]*\d+)?$/i.test(name)
  );
}

export function isPlaceholderUsername(value?: string | null): boolean {
  const username = value?.trim() ?? '';
  return (
    !username ||
    username.toLowerCase() === 'unknown' ||
    /^(?:مستخدم|مستحدم)(?:[_-]*\d+)?$/u.test(username) ||
    /^user(?:[_-]*\d+)?$/i.test(username)
  );
}

export function visibleProfileName(value?: string | null): string | null {
  const name = value?.trim() ?? '';
  return isPlaceholderProfileName(name) ? null : name;
}

export function visibleUsername(value?: string | null): string | null {
  const username = value?.trim() ?? '';
  return isPlaceholderUsername(username) ? null : username;
}
