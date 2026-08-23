import {
  verifyIdToken,
  isAdminConfigured,
  adminAuth,
  adminFirestore
} from '@lib/firebase-admin';
import { purgeUserData } from '@lib/server/purge-user';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * حذف الحساب نهائيًا — يحذف حساب المصادقة ووثيقة المستخدم وإحصاءاته.
 * يتطلب توكن المستخدم نفسه؛ لا يمكن لأي مستخدم حذف حساب غيره.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!isAdminConfigured() || !adminAuth || !adminFirestore) {
    res
      .status(503)
      .json({ error: 'الخدمة غير متاحة حاليًا — حاول مجددًا لاحقًا' });
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

    // حذف شامل لكل بيانات المستخدم (منشورات، ردود، قصص، محادثات، إشعارات، متابعات)
    const report = await purgeUserData(userId);

    res.status(200).json({ ok: true, report });
  } catch (error) {
    console.error('account/delete failed:', error);
    res.status(500).json({ error: 'تعذر حذف الحساب — حاول مجددًا' });
  }
}
