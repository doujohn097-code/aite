import admin from 'firebase-admin';
import { isAdminConfigured } from '@lib/firebase-admin';
import type { NextApiRequest } from 'next';

export function isAppCheckEnforced(): boolean {
  return process.env.FIREBASE_APPCHECK_ENFORCE === 'true';
}

export async function assertAppCheck(req: NextApiRequest): Promise<void> {
  if (!isAppCheckEnforced()) return;
  if (!isAdminConfigured()) throw new Error('appcheck_unavailable');
  const header = req.headers['x-firebase-appcheck'];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token) throw new Error('appcheck_missing');
  await admin.appCheck().verifyToken(token);
}
