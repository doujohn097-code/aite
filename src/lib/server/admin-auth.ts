import { createHash, timingSafeEqual } from 'crypto';
import { adminAuth, isAdminConfigured } from '@lib/firebase-admin';
import type { NextApiRequest } from 'next';

/** كلمة سر لوحة التحكم — تُضبط من متغيّر البيئة ADMIN */
export function getAdminPassword(): string {
  return (
    process.env.ADMIN ??
    process.env.ADMIN_PASSWORD ??
    process.env.ADMIN_KEY ??
    ''
  ).trim();
}

export function isAdminPasswordConfigured(): boolean {
  return getAdminPassword().length > 0;
}

/** مقارنة ثابتة الزمن لتفادي هجمات التوقيت */
export function matchesAdminPassword(candidate: unknown): boolean {
  const expected = getAdminPassword();

  if (!expected || typeof candidate !== 'string' || !candidate) return false;

  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();

  return timingSafeEqual(a, b);
}

/** كلمة السر تصل عبر ترويسة x-admin-key */
export function getRequestAdminKey(req: NextApiRequest): string {
  const header = req.headers['x-admin-key'];
  return Array.isArray(header) ? header[0] ?? '' : header ?? '';
}

/**
 * صلاحية الإدارة: كلمة سر ADMIN الصحيحة، أو توكن فايربيس يحمل claim الإدارة.
 */
export async function hasAdminAccess(req: NextApiRequest): Promise<boolean> {
  if (matchesAdminPassword(getRequestAdminKey(req))) return true;

  if (!isAdminConfigured() || !adminAuth) return false;

  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) return false;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.admin === true;
  } catch {
    return false;
  }
}
