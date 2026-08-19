import { adminAuth, adminFirestore } from '@lib/firebase/admin';
import { ADMIN_PASSWORD } from '@lib/admin';
import type { NextApiRequest, NextApiResponse } from 'next';

function getPassword(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '');
}

function checkPassword(password: string | null): boolean {
  if (!ADMIN_PASSWORD || !password) return false;
  return password === ADMIN_PASSWORD;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const password = getPassword(req);

  if (!checkPassword(password)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const snapshot = await adminFirestore
        .collection('users')
        .orderBy('createdAt', 'desc')
        .limit(1000)
        .get();
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.status(200).json({ users });
      return;
    }

    if (req.method === 'PATCH') {
      const { userId, verified } = req.body as {
        userId: string;
        verified: boolean;
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
      const { userId } = req.body as { userId: string };
      if (!userId) {
        res.status(400).json({ error: 'Invalid payload' });
        return;
      }
      await adminAuth.deleteUser(userId);
      await adminFirestore.collection('users').doc(userId).delete();
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin api error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}
