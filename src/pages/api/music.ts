import { verifyIdToken } from '@lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

export type MusicTrack = {
  id: number;
  name: string;
  artist: string;
  src: string;
  artwork: string | null;
  duration: number | null;
};

type ItunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
};

type ItunesResponse = {
  resultCount: number;
  results: ItunesResult[];
};

export default async function musicEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<{ tracks: MusicTrack[] } | { error: string }>
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await verifyIdToken(token);
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const term = (req.query.term as string | undefined)?.trim() ?? '';
  if (!term) {
    res.status(200).json({ tracks: [] });
    return;
  }

  const limit = Math.min(
    Math.max(parseInt((req.query.limit as string) ?? '25', 10) || 25, 1),
    50
  );

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term
  )}&limit=${limit}&media=music&entity=song`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      res.status(502).json({ error: 'Failed to reach music provider' });
      return;
    }

    const data = (await response.json()) as ItunesResponse;

    const tracks: MusicTrack[] = data.results
      .filter((r): r is ItunesResult & { previewUrl: string } => !!r.previewUrl)
      .map((r) => ({
        id: r.trackId ?? 0,
        name: r.trackName ?? 'Unknown track',
        artist: r.artistName ?? 'Unknown artist',
        src: r.previewUrl,
        artwork: r.artworkUrl100 ?? null,
        duration: r.trackTimeMillis
          ? Math.round(r.trackTimeMillis / 1000)
          : null
      }));

    // Cache the public response briefly on the edge
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({ tracks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search music' });
  }
}
