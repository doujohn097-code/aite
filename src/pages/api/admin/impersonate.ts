import {
  adminAuth,
  adminFirestore,
  isAdminConfigured
} from '@lib/firebase-admin';
import { hasAdminAccess } from '@lib/server/admin-auth';
import { consumeRateLimit } from '@lib/server/rate-limit';
import type { NextApiRequest, NextApiResponse } from 'next';

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

  try {
    if (!isAdminConfigured() || !adminAuth || !adminFirestore) {
      res.status(503).json({ error: 'خدمة الإدارة غير مهيأة' });
      return;
    }

    if (!(await hasAdminAccess(req))) {
      res.status(403).json({ error: 'صلاحية الإدارة مطلوبة' });
      return;
    }

    const rate = consumeRateLimit('admin-impersonate', 20, 5 * 60_000);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'محاولات كثيرة — حاول لاحقًا' });
      return;
    }

    const { userId } = (req.body ?? {}) as { userId?: unknown };
    if (typeof userId !== 'string' || !userId.trim() || userId.length > 128) {
      res.status(400).json({ error: 'معرّف الحساب غير صالح' });
      return;
    }

    const targetId = userId.trim();
    const snap = await adminFirestore.collection('users').doc(targetId).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'الحساب غير موجود' });
      return;
    }

    try {
      await adminAuth.getUser(targetId);
    } catch {
      res.status(404).json({ error: 'لا يوجد تسجيل دخول مرتبط بهذا الحساب' });
      return;
    }

    const data = snap.data() as {
      username?: string;
      name?: string;
    };
    const token = await adminAuth.createCustomToken(targetId, {
      impersonated: true
    });

    res.status(200).json({
      token,
      userId: targetId,
      username: typeof data.username === 'string' ? data.username : '',
      name: typeof data.name === 'string' ? data.name : ''
    });
  } catch (error) {
    console.error('admin impersonate failed:', error);
    res.status(500).json({ error: 'تعذر فتح الحساب' });
  }
}
