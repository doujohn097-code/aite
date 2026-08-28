import { adminFirestore, isAdminConfigured } from '@lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

function cleanUsername(value: string): string | null {
  const username = value.trim().toLowerCase();
  return /^[a-z0-9_]{3,15}$/.test(username) ? username : null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const raw =
    typeof req.query.usernames === 'string' ? req.query.usernames : '';
  const usernames = Array.from(
    new Set(
      raw
        .split(',')
        .map(cleanUsername)
        .filter((value): value is string => !!value)
    )
  ).slice(0, 8);

  if (!usernames.length) {
    res.status(200).json({ profiles: [] });
    return;
  }

  if (!isAdminConfigured() || !adminFirestore) {
    res.status(200).json({ profiles: [] });
    return;
  }

  try {
    const snapshot = await adminFirestore
      .collection('users')
      .where('username', 'in', usernames)
      .get();

    const profiles = snapshot.docs.map((document) => {
      const data = document.data();
      const username =
        typeof data.username === 'string' ? data.username : document.id;
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      const photoURL =
        typeof data.photoURL === 'string' && data.photoURL.trim()
          ? data.photoURL.trim()
          : null;
      return {
        username,
        name: name || username,
        photoURL
      };
    });

    res.setHeader('Cache-Control', 'private, max-age=30');
    res.status(200).json({ profiles });
  } catch (error) {
    console.error('account/profiles failed:', error);
    res.status(200).json({ profiles: [] });
  }
}
