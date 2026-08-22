import {
  verifyIdToken,
  isAdminConfigured,
  adminAuth,
  adminFirestore
} from '@lib/firebase-admin';
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
    res.status(503).json({ error: 'الخدمة غير متاحة حاليًا — حاول مجددًا لاحقًا' });
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

    // حذف بيانات المستخدم الفرعية (الإحصاءات، الإشارات المرجعية) ثم الوثيقة
    const userRef = adminFirestore.collection('users').doc(userId);
    try {
      await adminFirestore.recursiveDelete(userRef);
    } catch {
      // في حال فشل الحذف العميق، احذف الوثيقة الأساسية على الأقل
      await userRef.delete().catch(() => undefined);
    }

    // حذف اسم المستخدم المحجوز إن وجد
    try {
      const usernameSnap = await adminFirestore
        .collection('usernames')
        .where('userId', '==', userId)
        .get();
      await Promise.all(usernameSnap.docs.map((doc) => doc.ref.delete()));
    } catch {
      // مجموعة أسماء المستخدمين اختيارية
    }

    // حذف حساب المصادقة أخيرًا
    await adminAuth.deleteUser(userId);

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('account/delete failed:', error);
    res.status(500).json({ error: 'تعذر حذف الحساب — حاول مجددًا' });
  }
}
