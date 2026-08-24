import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { verifyIdToken } from '@lib/firebase-admin';
import { consumeRateLimit } from '@lib/server/rate-limit';
import {
  downloadToFile,
  execFfmpeg,
  isAllowedSource,
  readMediaCache,
  sha256Hex,
  uploadBufferToR2,
  writeMediaCache
} from '@lib/media-server';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Extracts a real frame (near the beginning) from a video and uploads it as
 * a JPEG poster, so previews show a picture of the video — exactly like the
 * web — instead of a black/gray box on devices whose decoder cannot render
 * the raw file (mobile browsers). Results are cached in Firestore.
 */
export default async function posterMediaEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<Record<string, unknown>>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as { src?: unknown } | null;
  const src = typeof body?.src === 'string' ? body.src : '';
  if (!isAllowedSource(src)) {
    res.status(400).json({ error: 'Invalid media source' });
    return;
  }

  try {
    const { uid } = await verifyIdToken(token);
    const rate = consumeRateLimit(`poster:${uid}`, 12, 60_000);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    // Already extracted? Serve the cached poster without re-encoding.
    const cacheKey = `poster-${sha256Hex(src).slice(0, 48)}`;
    const cached = await readMediaCache(cacheKey, src);
    if (cached) {
      res.status(200).json({ src: cached });
      return;
    }

    const workDir = mkdtempSync(join(tmpdir(), 'aite-poster-'));
    const inputPath = join(workDir, 'input');
    const outputPath = join(workDir, 'poster.jpg');
    try {
      await downloadToFile(src, inputPath);

      // Try a frame 0.3 s in, then fall back to the very first frame.
      let posterOk = false;
      let lastResult: Awaited<ReturnType<typeof execFfmpeg>> | null = null;
      for (const seek of ['0.3', '0']) {
        const args = [
          '-y',
          '-ss',
          seek,
          '-i',
          inputPath,
          '-frames:v',
          '1',
          '-vf',
          "scale='min(720,iw)':-2",
          '-q:v',
          '3',
          outputPath
        ];
        lastResult = await execFfmpeg(args);
        if (lastResult.ok && existsSync(outputPath)) {
          posterOk = true;
          break;
        }
      }
      if (!posterOk) {
        console.error(
          'media poster failed:',
          lastResult?.error ?? 'output missing'
        );
        res.status(200).json({ src: '' });
        return;
      }

      const posterSrc = await uploadBufferToR2(
        `media/posters/${sha256Hex(src).slice(0, 20)}.jpg`,
        'image/jpeg',
        readFileSync(outputPath)
      );
      if (!posterSrc) {
        res.status(200).json({ src: '' });
        return;
      }
      await writeMediaCache(cacheKey, src, posterSrc);
      res.status(200).json({ src: posterSrc });
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  } catch {
    res.status(200).json({ src: '' }); // Never break previews because of repair.
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' }
  }
};
