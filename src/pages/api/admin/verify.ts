import {
  isAdminPasswordConfigured,
  matchesAdminPassword
} from '@lib/server/admin-auth';
import { consumeRateLimit } from '@lib/server/rate-limit';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * التحقق من كلمة سر لوحة التحكم (متغيّر البيئة ADMIN).
 * لا يُعيد أي معلومة عن كلمة السر نفسها.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
): void {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded ?? 'unknown')
    .split(',')[0]
    .trim();
  const rate = consumeRateLimit(`admin-login:${ip}`, 5, 15 * 60_000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    res.status(429).json({ error: 'محاولات كثيرة — حاول لاحقًا' });
    return;
  }

  if (!isAdminPasswordConfigured()) {
    res
      .status(503)
      .json({ error: 'لم يتم ضبط متغيّر البيئة ADMIN على الخادم' });
    return;
  }

  const { password } = (req.body ?? {}) as { password?: string };

  if (!matchesAdminPassword(password)) {
    res.status(401).json({ error: 'كلمة السر غير صحيحة' });
    return;
  }

  res.status(200).json({ ok: true });
}
