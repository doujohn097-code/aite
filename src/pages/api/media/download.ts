import { createHmac, timingSafeEqual } from 'crypto';
import { verifyIdToken } from '@lib/firebase-admin';
import {
  filenameFromMedia,
  isAllowedMediaDownloadUrl
} from '@lib/media-download';
import { consumeRateLimit } from '@lib/server/rate-limit';
import type { NextApiRequest, NextApiResponse } from 'next';

const MAX_BYTES = 80 * 1024 * 1024;
const TICKET_TTL_MS = 90_000;

function ticketSecret(): string {
  return (
    process.env.FIREBASE_ADMIN_KEY ||
    process.env.R2_SECRET_ACCESS_KEY ||
    'aite-download'
  );
}

function signTicket(payload: string): string {
  return createHmac('sha256', ticketSecret()).update(payload).digest('base64url');
}

function makeTicket(url: string, name: string, uid: string): string {
  const body = Buffer.from(
    JSON.stringify({
      url,
      name,
      uid,
      exp: Date.now() + TICKET_TTL_MS
    })
  ).toString('base64url');
  return `${body}.${signTicket(body)}`;
}

function readTicket(
  ticket: string
): { url: string; name: string; uid: string } | null {
  const [body, signature] = ticket.split('.');
  if (!body || !signature) return null;
  const expected = signTicket(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as { url?: string; name?: string; uid?: string; exp?: number };
    if (!data.url || !data.uid || !data.exp || data.exp < Date.now())
      return null;
    if (!isAllowedMediaDownloadUrl(data.url)) return null;
    return {
      url: data.url,
      name: typeof data.name === 'string' ? data.name : 'aite-media',
      uid: data.uid
    };
  } catch {
    return null;
  }
}

async function streamFile(
  res: NextApiResponse,
  rawUrl: string,
  filename: string
): Promise<void> {
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

  const asciiName = filename.replace(/[^\w.\-]+/g, '_') || 'aite-media';
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
      filename
    )}`
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
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    if (req.method === 'POST') {
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
      const body = (req.body ?? {}) as { url?: unknown; name?: unknown };
      const rawUrl = typeof body.url === 'string' ? body.url : '';
      if (!isAllowedMediaDownloadUrl(rawUrl)) {
        res.status(400).json({ error: 'invalid_url' });
        return;
      }
      const name = filenameFromMedia(
        rawUrl,
        typeof body.name === 'string' ? body.name : ''
      );
      res.status(200).json({ ticket: makeTicket(rawUrl, name, uid) });
      return;
    }

    const ticketValue =
      typeof req.query.ticket === 'string' ? req.query.ticket : '';
    if (ticketValue) {
      const ticket = readTicket(ticketValue);
      if (!ticket) {
        res.status(403).json({ error: 'invalid_ticket' });
        return;
      }
      await streamFile(res, ticket.url, ticket.name);
      return;
    }

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
    await streamFile(res, rawUrl, filenameFromMedia(rawUrl, requestedName));
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
