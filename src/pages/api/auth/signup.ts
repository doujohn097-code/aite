import { createAccount } from '@lib/auth-router';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/auth/signup
 * Body: { username, password, name }
 * Creates the account in the round-robin project (primary or secondary
 * database), mirrors profile + stats documents, and registers the account
 * in the router registry. Returns the assigned project and internal email.
 */
export default async function signupHandler(
  req: NextApiRequest,
  res: NextApiResponse<
    | { project: 'a' | 'b'; email: string; uid: string }
    | { error: string; message?: string }
  >
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  try {
    const body = req.body as {
      username?: unknown;
      password?: unknown;
      name?: unknown;
    } | null;
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const name = typeof body?.name === 'string' ? body.name : '';

    if (!username || !password || !name) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }

    const result = await createAccount({ username, password, name });
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    const status =
      message === 'username_taken'
        ? 409
        : message === 'weak_password' || message === 'invalid_username'
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
