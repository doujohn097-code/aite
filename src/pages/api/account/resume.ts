import {
  adminAuth,
  adminFirestore,
  isAdminConfigured
} from '@lib/firebase-admin';
import { consumeDeviceSession } from '@lib/server/device-session';
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

  if (!isAdminConfigured() || !adminAuth || !adminFirestore) {
    res.status(503).json({ error: 'unavailable' });
    return;
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded ?? 'unknown')
    .split(',')[0]
    .trim();
  const rate = consumeRateLimit(`account-resume:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  try {
    const body = (req.body ?? {}) as { username?: unknown; token?: unknown };
    const username =
      typeof body.username === 'string'
        ? body.username.trim().toLowerCase()
        : '';
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!/^[a-z0-9_]{3,15}$/.test(username) || token.length < 20) {
      res.status(400).json({ error: 'invalid' });
      return;
    }

    const snapshot = await adminFirestore
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();
    if (snapshot.empty) {
      res.status(401).json({ error: 'invalid' });
      return;
    }

    const userId = snapshot.docs[0].id;
    const ok = await consumeDeviceSession(userId, token);
    if (!ok) {
      res.status(401).json({ error: 'invalid' });
      return;
    }

    try {
      await adminAuth.getUser(userId);
    } catch {
      res.status(401).json({ error: 'invalid' });
      return;
    }

    const customToken = await adminAuth.createCustomToken(userId);
    res.status(200).json({ token: customToken });
  } catch (error) {
    console.error('account/resume failed:', error);
    res.status(500).json({ error: 'resume_failed' });
  }
}
