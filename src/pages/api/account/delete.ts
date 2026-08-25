import {
  adminAuth,
  isAdminConfigured,
  verifyIdToken
} from '@lib/firebase-admin';
import { purgeUserData } from '@lib/server/purge-user';
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
    const authHeader = req.headers.authorization ?? '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const decoded = await verifyIdToken(idToken);
    const userId = decoded.uid;
    const password =
      typeof (req.body as { password?: unknown })?.password === 'string'
        ? (req.body as { password: string }).password
        : '';

    if (!password) {
      res.status(400).json({ error: 'missing_password' });
      return;
    }

    const record = await adminAuth.getUser(userId);
    const email = record.email ?? decoded.email;
    if (!email) {
      res.status(400).json({ error: 'missing_email' });
      return;
    }

    const valid = await verifyAccountPassword(email, password);
    if (!valid) {
      res.status(403).json({ error: 'wrong_password' });
      return;
    }

    const report = await purgeUserData(userId);
    res.status(200).json({ ok: true, report });
  } catch (error) {
    console.error('account/delete failed:', error);
    res.status(500).json({ error: 'delete_failed' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '16kb' } }
};
