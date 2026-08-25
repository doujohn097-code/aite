import { verifyIdToken, isAdminConfigured } from '@lib/firebase-admin';
import {
  createDeviceToken,
  saveDeviceSession
} from '@lib/server/device-session';
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

  if (!isAdminConfigured()) {
    res.status(503).json({ error: 'unavailable' });
    return;
  }

  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const { uid } = await verifyIdToken(token);
    const rate = consumeRateLimit(`device-session:${uid}`, 8, 60_000);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'rate_limited' });
      return;
    }
    const resumeToken = createDeviceToken();
    await saveDeviceSession(uid, resumeToken);
    res.status(200).json({ resumeToken });
  } catch (error) {
    console.error('account/session failed:', error);
    res.status(500).json({ error: 'session_failed' });
  }
}
