import { adminAuth, adminFirestore } from '@lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

async function requireAdmin(req: NextApiRequest): Promise<boolean> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded.admin === true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    if (!(await requireAdmin(req))) {
      res.status(403).json({ error: 'Admin access is required' });
      return;
    }

    if (req.method === 'GET') {
      const snapshot = await adminFirestore
        .collection('users')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.status(200).json({ users });
      return;
    }

    if (req.method === 'PATCH') {
      const { userId, verified } = req.body as {
        userId?: string;
        verified?: boolean;
      };
      if (!userId || typeof verified !== 'boolean') {
        res.status(400).json({ error: 'Invalid payload' });
        return;
      }
      await adminFirestore.collection('users').doc(userId).update({ verified });
      res.status(200).json({ success: true });
      return;
    }

    if (req.method === 'DELETE') {
      const { userId } = req.body as { userId?: string };
      if (!userId) {
        res.status(400).json({ error: 'Invalid payload' });
        return;
      }
      await adminAuth.deleteUser(userId);
      await adminFirestore.collection('users').doc(userId).delete();
      res.status(200).json({ success: true });
      return;
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    // Avoid leaking Firebase internals or token parsing details to clients.
    console.error('admin api error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
}
