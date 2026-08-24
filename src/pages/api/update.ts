import { adminFirestore, isAdminConfigured } from '@lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { AppUpdateTarget } from '@lib/types/app-update';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    if (!isAdminConfigured() || !adminFirestore) {
      res.status(200).json({ update: null });
      return;
    }

    const snap = await adminFirestore.doc('config/appUpdate').get();
    const data = snap.data();
    if (!data || data.active !== true) {
      res.status(200).json({ update: null });
      return;
    }

    const target = data.target;
    const safeTarget: AppUpdateTarget =
      target === 'android' || target === 'web' || target === 'all'
        ? target
        : 'all';

    res.status(200).json({
      update: {
        id: String(data.id ?? snap.id),
        active: true,
        force: data.force === true,
        versionName: String(data.versionName ?? ''),
        versionCode: Number(data.versionCode) || 0,
        title: String(data.title ?? 'تحديث جديد'),
        message: String(data.message ?? ''),
        apkUrl:
          typeof data.apkUrl === 'string' && data.apkUrl.trim()
            ? data.apkUrl.trim()
            : null,
        target: safeTarget,
        createdAt: data.createdAt ?? null
      }
    });
  } catch (error) {
    console.error('public update read failed:', error);
    res.status(200).json({ update: null });
  }
}
