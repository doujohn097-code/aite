import { mintPeerToken } from '@lib/auth-router';
import { verifyIdTokenAny } from '@lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/auth/peer-token
 * Auth: any project's ID token.
 * Returns a custom token for the OTHER project (same uid) so the client can
 * sign into both databases and read/write content from both.
 */
export default async function peerTokenHandler(
  req: NextApiRequest,
  res: NextApiResponse<
    { token: string; project: 'a' | 'b' } | { error: string }
  >
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  try {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const { decoded, project } = await verifyIdTokenAny(token);
    const peerToken = await mintPeerToken(decoded.uid, project);
    res.status(200).json({ token: peerToken, project });
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
