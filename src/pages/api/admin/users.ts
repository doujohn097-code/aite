import { adminFirestore, isAdminConfigured } from '@lib/firebase-admin';
import { hasAdminAccess } from '@lib/server/admin-auth';
import { purgeUserData } from '@lib/server/purge-user';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    if (!isAdminConfigured() || !adminFirestore) {
      res.status(503).json({
        error: 'Admin service not configured - FIREBASE_ADMIN_KEY missing'
      });
      return;
    }

    if (!(await hasAdminAccess(req))) {
      res.status(403).json({ error: 'صلاحية الإدارة مطلوبة' });
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

      // حذف شامل: المنشورات والردود والقصص والمحادثات والإشعارات والمتابعات
      const report = await purgeUserData(userId);

      res.status(200).json({ success: true, report });
      return;
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin api error:', error);
    res.status(500).json({ error: 'تعذر تنفيذ العملية' });
  }
}
