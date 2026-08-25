import admin from 'firebase-admin';
import {
  adminFirestore,
  isAdminConfigured,
  verifyIdToken
} from '@lib/firebase-admin';
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
    if (!isAdminConfigured() || !adminFirestore) {
      res.status(503).json({ error: 'service_unavailable' });
      return;
    }

    const header = req.headers.authorization ?? '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!idToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const decoded = await verifyIdToken(idToken);
    if (decoded.impersonated === true) {
      res.status(403).json({ error: 'impersonation_forbidden' });
      return;
    }

    const rate = consumeRateLimit(`claim-device:${decoded.uid}`, 8, 60_000);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    const token =
      typeof (req.body as { token?: unknown })?.token === 'string'
        ? (req.body as { token: string }).token.trim()
        : '';
    if (token.length < 20 || token.length > 4096) {
      res.status(400).json({ error: 'invalid_token' });
      return;
    }

    const snapshot = await adminFirestore
      .collection('users')
      .where('fcmTokens', 'array-contains', token)
      .limit(50)
      .get();

    const batch = adminFirestore.batch();
    let removed = 0;
    snapshot.forEach((docSnap) => {
      if (docSnap.id === decoded.uid) return;
      batch.update(docSnap.ref, {
        fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
      });
      removed += 1;
    });

    batch.set(
      adminFirestore.collection('users').doc(decoded.uid),
      { fcmTokens: admin.firestore.FieldValue.arrayUnion(token) },
      { merge: true }
    );

    await batch.commit();

    res.status(200).json({ ok: true, removed });
  } catch (error) {
    console.error('claim-device failed:', error);
    res.status(500).json({ error: 'internal' });
  }
}
