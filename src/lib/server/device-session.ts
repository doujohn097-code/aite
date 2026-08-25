import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { adminFirestore } from '@lib/firebase-admin';

const MAX_SESSIONS = 8;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createDeviceToken(): string {
  return randomBytes(32).toString('hex');
}

export async function saveDeviceSession(
  userId: string,
  token: string
): Promise<void> {
  if (!adminFirestore) throw new Error('admin_not_configured');
  const hash = hashDeviceToken(token);
  const col = adminFirestore
    .collection('users')
    .doc(userId)
    .collection('deviceSessions');
  await col.doc(hash).set({
    hash,
    createdAt: Date.now(),
    lastUsedAt: Date.now()
  });

  const existing = await col.orderBy('lastUsedAt', 'desc').get();
  const stale = existing.docs.filter((doc, index) => {
    const lastUsed =
      typeof doc.data().lastUsedAt === 'number' ? doc.data().lastUsedAt : 0;
    return index >= MAX_SESSIONS || Date.now() - lastUsed > SESSION_TTL_MS;
  });
  await Promise.all(stale.map((doc) => doc.ref.delete()));
}

export async function consumeDeviceSession(
  userId: string,
  token: string
): Promise<boolean> {
  if (!adminFirestore) return false;
  const hash = hashDeviceToken(token);
  const ref = adminFirestore
    .collection('users')
    .doc(userId)
    .collection('deviceSessions')
    .doc(hash);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const stored = String(snap.data()?.hash ?? '');
  const left = Buffer.from(stored);
  const right = Buffer.from(hash);
  if (left.length !== right.length || !timingSafeEqual(left, right))
    return false;
  const lastUsed =
    typeof snap.data()?.lastUsedAt === 'number' ? snap.data()!.lastUsedAt : 0;
  if (Date.now() - lastUsed > SESSION_TTL_MS) {
    await ref.delete().catch(() => undefined);
    return false;
  }
  await ref.update({ lastUsedAt: Date.now() }).catch(() => undefined);
  return true;
}
