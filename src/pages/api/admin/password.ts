import { adminAuth, isAdminConfigured } from '@lib/firebase-admin';
import { hasAdminAccess } from '@lib/server/admin-auth';
import {
  findAuthUser,
  getProfileUsername,
  syncAuthEmailWithUsername
} from '@lib/server/auth-identity';
import { verifyAccountPassword } from '@lib/server/verify-password';
import { usernameToInternalEmail } from '@lib/utils';
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

    // اسم المستخدم الحالي من Firestore — هو ما يكتبه المستخدم عند الدخول
    const username = await getProfileUsername(userId);
    const record = await findAuthUser(userId, username);

    if (!record) {
      // لا يوجد حساب مصادقة لهذا الملف — ننشئه حتى يعمل الدخول
      if (!username) {
        res.status(404).json({ error: 'لا يوجد حساب مصادقة لهذا المستخدم' });
        return;
      }

      await adminAuth.createUser({
        uid: userId,
        email: usernameToInternalEmail(username),
        emailVerified: true,
        password
      });

      res.status(200).json({ success: true, username, created: true });
      return;
    }

    // أهم إصلاح: مزامنة البريد الداخلي مع اسم المستخدم الحالي.
    // بدونها يفشل الدخول بعد أي تغيير لاسم المستخدم مهما كانت كلمة السر صحيحة.
    const email = await syncAuthEmailWithUsername(record, username);

    await adminAuth.updateUser(record.uid, {
      password,
      ...(record.disabled ? { disabled: false } : {})
    });

    // إبطال الجلسات القديمة بعد تغيير كلمة السر
    await adminAuth.revokeRefreshTokens(record.uid).catch(() => undefined);

    // تحقق فعلي: لا نُبلغ بالنجاح إلا إذا كان الدخول بكلمة السر الجديدة ممكنًا
    const signInEmail = email || record.email || '';
    const works = signInEmail
      ? await verifyAccountPassword(signInEmail, password)
      : false;

    if (!works) {
      res.status(502).json({
        error:
          'تم حفظ كلمة السر لكن تعذر التحقق من تسجيل الدخول بها — راجع إعدادات Firebase'
      });
      return;
    }

    res.status(200).json({ success: true, username, email: signInEmail });
  } catch (error) {
    console.error('admin password error:', error);
    res.status(500).json({ error: 'تعذر تغيير كلمة المرور' });
  }
}
