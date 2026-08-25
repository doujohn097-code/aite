import { verifyIdToken } from '@lib/firebase-admin';
import {
  filenameFromMedia,
  isAllowedMediaDownloadUrl
} from '@lib/media-download';
import { consumeRateLimit } from '@lib/server/rate-limit';
import type { NextApiRequest, NextApiResponse } from 'next';

const MAX_BYTES = 80 * 1024 * 1024;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const { uid } = await verifyIdToken(token);
    const rate = consumeRateLimit(`media-download:${uid}`, 20, 60_000);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!isAllowedMediaDownloadUrl(rawUrl)) {
      res.status(400).json({ error: 'invalid_url' });
      return;
    }

    const requestedName =
      typeof req.query.name === 'string' ? req.query.name : '';
    const filename = filenameFromMedia(rawUrl, requestedName);

    const upstream = await fetch(rawUrl, {
      headers: { Accept: 'image/*,video/*,application/octet-stream' }
    });
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: 'fetch_failed' });
      return;
    }

    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream';
    const lengthHeader = upstream.headers.get('content-length');
    const length = lengthHeader ? Number(lengthHeader) : NaN;
    if (Number.isFinite(length) && length > MAX_BYTES) {
      res.status(413).json({ error: 'too_large' });
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"`
    );
    res.setHeader('Cache-Control', 'private, no-store');
    if (Number.isFinite(length) && length > 0)
      res.setHeader('Content-Length', String(length));

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      res.status(413).json({ error: 'too_large' });
      return;
    }
    res.status(200).send(buffer);
  } catch (error) {
    console.error('media/download failed:', error);
    res.status(500).json({ error: 'download_failed' });
  }
}

export const config = {
  api: {
    responseLimit: '80mb'
  }
};
