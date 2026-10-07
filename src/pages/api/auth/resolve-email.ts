import { adminAuth, isAdminConfigured } from '@lib/firebase-admin';
import {
  findAuthUser,
  getUidByUsername,
  syncAuthEmailWithUsername
} from '@lib/server/auth-identity';
import { consumeRateLimit } from '@lib/server/rate-limit';
import { usernameToInternalEmail } from '@lib/utils';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * يُرجع البريد الداخلي الصحيح لحساب موجود باسم مستخدم معيّن.
 *
 * ضروري للحسابات القديمة التي غُيّر اسمها دون مزامنة بريد المصادقة:
 * بدون هذا المسار يبقى الدخول مستحيلًا حتى بعد تغيير كلمة السر.
 * لا يكشف المسار أي بيانات حساسة (البريد داخلي ومشتق من الاسم العلني).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
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
  const rate = consumeRateLimit(`resolve-email:${ip}`, 20, 10 * 60_000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    res.status(429).json({ error: 'too_many_requests' });
    return;
  }

  if (!isAdminConfigured() || !adminAuth) {
    res.status(503).json({ error: 'service_unavailable' });
    return;
  }

  try {
    const body = (req.body ?? {}) as { username?: unknown };
    const username =
      typeof body.username === 'string'
        ? body.username.trim().replace(/\s+/g, '').toLowerCase()
        : '';

    if (!username || !/^\w{3,15}$/.test(username)) {
      res.status(400).json({ error: 'invalid_username' });
      return;
    }

    const uid = await getUidByUsername(username);
    const record = await findAuthUser(uid ?? '', username);

    if (!record) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // نصلح الانحراف فورًا حتى تعمل المحاولات القادمة بالبريد المتوقع
    const email = await syncAuthEmailWithUsername(record, username);

    res.status(200).json({ email: email || usernameToInternalEmail(username) });
  } catch (error) {
    console.error('resolve-email failed:', error);
    res.status(500).json({ error: 'resolve_failed' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '8kb' } }
};
