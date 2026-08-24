import admin from 'firebase-admin';
import { adminFirestore, isAdminConfigured } from '@lib/firebase-admin';
import { hasAdminAccess } from '@lib/server/admin-auth';
import { isSafeApkUrl } from '@lib/app-update';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { AppUpdateTarget } from '@lib/types/app-update';

const DOC = 'config/appUpdate';

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    if (!isAdminConfigured() || !adminFirestore) {
      res.status(503).json({ error: 'خدمة الإدارة غير مهيأة' });
      return;
    }
    if (!(await hasAdminAccess(req))) {
      res.status(403).json({ error: 'صلاحية الإدارة مطلوبة' });
      return;
    }

    const ref = adminFirestore.doc(DOC);

    if (req.method === 'GET') {
      const snap = await ref.get();
      res.status(200).json({ update: snap.exists ? snap.data() : null });
      return;
    }

    if (req.method === 'DELETE') {
      await ref.set({ active: false }, { merge: true });
      res.status(200).json({ success: true });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body as {
        versionName?: string;
        versionCode?: number;
        title?: string;
        message?: string;
        apkUrl?: string | null;
        force?: boolean;
        target?: AppUpdateTarget;
      };
      const versionName = cleanText(body.versionName, 32);
      const versionCode = Number(body.versionCode);
      const title = cleanText(body.title, 80) || 'تحديث جديد';
      const message = cleanText(body.message, 500);
      const apkUrl = cleanText(body.apkUrl, 2048);
      const target: AppUpdateTarget =
        body.target === 'android' || body.target === 'web'
          ? body.target
          : 'all';

      if (!/^[0-9A-Za-z._-]{1,32}$/.test(versionName)) {
        res.status(400).json({ error: 'رقم الإصدار غير صالح' });
        return;
      }
      if (
        !Number.isInteger(versionCode) ||
        versionCode < 1 ||
        versionCode > 999999
      ) {
        res
          .status(400)
          .json({ error: 'رمز الإصدار يجب أن يكون رقماً أكبر من 0' });
        return;
      }
      if (apkUrl && !isSafeApkUrl(apkUrl)) {
        res
          .status(400)
          .json({ error: 'رابط الـ APK يجب أن يكون https وينتهي بـ .apk' });
        return;
      }

      const update = {
        id: `v${versionCode}-${Date.now()}`,
        active: true,
        force: body.force === true,
        versionName,
        versionCode,
        title,
        message,
        apkUrl: apkUrl || null,
        target,
        createdAt: new Date()
      };
      await ref.set(update);
      res.status(200).json({ success: true, update });
      return;
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin update error:', error);
    res.status(500).json({ error: 'تعذر حفظ التحديث' });
  }
}
