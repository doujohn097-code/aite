import { routeAccount } from '@lib/auth-router';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/auth/route
 * Body: { identifier: string } — username or email.
 * Returns which project the account lives on (or not found).
 */
export default async function routeHandler(
  req: NextApiRequest,
  res: NextApiResponse<{ found: boolean; project?: 'a' | 'b' }>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ found: false });
    return;
  }
  try {
    const body = req.body as { identifier?: unknown } | null;
    const identifier =
      typeof body?.identifier === 'string' ? body.identifier : '';
    if (!identifier) {
      res.status(400).json({ found: false });
      return;
    }
    const result = await routeAccount(identifier);
    res.status(200).json(result);
  } catch {
    res.status(200).json({ found: false });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
