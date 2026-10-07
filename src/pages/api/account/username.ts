import {
  adminAuth,
  adminFirestore,
  isAdminConfigured,
  verifyIdToken
} from '@lib/firebase-admin';
import { syncAuthEmailWithUsername } from '@lib/server/auth-identity';
import { consumeRateLimit } from '@lib/server/rate-limit';
import { usernameToInternalEmail } from '@lib/utils';
import type { NextApiRequest, NextApiResponse } from 'next';

const USERNAME_PATTERN = /^\w{3,15}$/;

/**
 * تغيير اسم المستخدم مع مزامنة بريد المصادقة الداخلي.
 *
 * الدخول يتم بالبريد المشتق من اسم المستخدم، لذلك تغيير الاسم في Firestore
 * وحده كان يكسر تسجيل الدخول نهائيًا.
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

  if (!isAdminConfigured() || !adminAuth || !adminFirestore) {
    res.status(503).json({ error: 'service_unavailable' });
    return;
  }

  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const decoded = await verifyIdToken(token);

    const rate = consumeRateLimit(`username:${decoded.uid}`, 5, 10 * 60_000);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'too_many_requests' });
      return;
    }

    const body = (req.body ?? {}) as { username?: unknown };
    const username =
      typeof body.username === 'string'
        ? body.username.trim().replace(/\s+/g, '').toLowerCase()
        : '';

    if (!username || !USERNAME_PATTERN.test(username)) {
      res.status(400).json({ error: 'invalid_username' });
      return;
    }

    const taken = await adminFirestore
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (!taken.empty && taken.docs[0].id !== decoded.uid) {
      res.status(409).json({ error: 'username_taken' });
      return;
    }

    const email = usernameToInternalEmail(username).toLowerCase();

    // تأكد أن البريد غير محجوز بحساب آخر قبل أي كتابة
    try {
      const clash = await adminAuth.getUserByEmail(email);
      if (clash.uid !== decoded.uid) {
        res.status(409).json({ error: 'username_taken' });
        return;
      }
    } catch {
      // البريد متاح
    }

    const record = await adminAuth.getUser(decoded.uid);
    const syncedEmail = await syncAuthEmailWithUsername(record, username);

    await adminFirestore.collection('users').doc(decoded.uid).set(
      {
        username,
        updatedAt: new Date()
      },
      { merge: true }
    );

    res.status(200).json({ ok: true, username, email: syncedEmail });
  } catch (error) {
    console.error('account/username failed:', error);
    res.status(500).json({ error: 'username_update_failed' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '8kb' } }
};
