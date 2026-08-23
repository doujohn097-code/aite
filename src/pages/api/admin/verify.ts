import {
  isAdminPasswordConfigured,
  matchesAdminPassword
} from '@lib/server/admin-auth';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * التحقق من كلمة سر لوحة التحكم (متغيّر البيئة ADMIN).
 * لا يُعيد أي معلومة عن كلمة السر نفسها.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
): void {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!isAdminPasswordConfigured()) {
    res
      .status(503)
      .json({ error: 'لم يتم ضبط متغيّر البيئة ADMIN على الخادم' });
    return;
  }

  const { password } = (req.body ?? {}) as { password?: string };

  if (!matchesAdminPassword(password)) {
    res.status(401).json({ error: 'كلمة السر غير صحيحة' });
    return;
  }

  res.status(200).json({ ok: true });
}
