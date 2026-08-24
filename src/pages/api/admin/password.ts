import { adminAuth, isAdminConfigured } from '@lib/firebase-admin';
import { hasAdminAccess } from '@lib/server/admin-auth';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!isAdminConfigured() || !adminAuth) {
      res.status(503).json({ error: 'خدمة الإدارة غير مهيأة' });
      return;
    }
    if (!(await hasAdminAccess(req))) {
      res.status(403).json({ error: 'صلاحية الإدارة مطلوبة' });
      return;
    }

    const { userId, password } = req.body as {
      userId?: string;
      password?: string;
    };
    if (!userId || typeof password !== 'string') {
      res.status(400).json({ error: 'بيانات غير صالحة' });
      return;
    }
    if (password.length < 6 || password.length > 72) {
      res
        .status(400)
        .json({ error: 'كلمة المرور يجب أن تكون بين 6 و 72 حرفاً' });
      return;
    }

    await adminAuth.updateUser(userId, { password });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('admin password error:', error);
    res.status(500).json({ error: 'تعذر تغيير كلمة المرور' });
  }
}
