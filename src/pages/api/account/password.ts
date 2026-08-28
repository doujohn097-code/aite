import {
  adminAuth,
  isAdminConfigured,
  verifyIdToken
} from '@lib/firebase-admin';
import { verifyAccountPassword } from '@lib/server/verify-password';
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

  if (!isAdminConfigured() || !adminAuth) {
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
    const body = (req.body ?? {}) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };
    const currentPassword =
      typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword =
      typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 72) {
      res.status(400).json({ error: 'weak_password' });
      return;
    }
    if (newPassword === currentPassword) {
      res.status(400).json({ error: 'same_password' });
      return;
    }

    const record = await adminAuth.getUser(decoded.uid);
    const email = record.email ?? decoded.email;
    if (!email) {
      res.status(400).json({ error: 'missing_email' });
      return;
    }

    const valid = await verifyAccountPassword(email, currentPassword);
    if (!valid) {
      res.status(403).json({ error: 'wrong_password' });
      return;
    }

    await adminAuth.updateUser(decoded.uid, { password: newPassword });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('account/password failed:', error);
    res.status(500).json({ error: 'change_failed' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '16kb' } }
};
