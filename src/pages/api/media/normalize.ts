import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { verifyIdToken } from '@lib/firebase-admin';
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
 * Re-encodes raw phone uploads (HEVC, H.264 High@L5.2, .mov, non-faststart
 * MP4) into a universally playable MP4 — H.264 High@L4.0, faststart, AAC.
 * Desktop Chrome software-decodes the originals, but mobile browsers's
 * hardware decoder caps at H.264 level 4.x, which is the gray box bug.
 */
export default async function normalizeMediaEndpoint(
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

    // Already normalized? Serve the cached result without re-encoding.
    const cacheKey = `norm-${sha256Hex(src).slice(0, 48)}`;
    const cached = await readMediaCache(cacheKey, src);
    if (cached) {
      res.status(200).json({ src: cached });
      return;
    }

    const workDir = mkdtempSync(join(tmpdir(), 'aite-fix-'));
    const inputPath = join(workDir, 'input');
    const outputPath = join(workDir, 'fixed.mp4');
    try {
      await downloadToFile(src, inputPath);
      const args = [
        '-y',
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-c:v',
        'libx264',
        '-profile:v',
        'high',
        '-level',
        '4.0',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-r',
        '30',
        '-vf',
        "scale='min(1920,iw)':-2",
        '-maxrate',
        '8M',
        '-bufsize',
        '16M',
        '-movflags',
        '+faststart',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ac',
        '2',
        outputPath
      ];
      const result = await execFfmpeg(args);
      const ok = result.ok && existsSync(outputPath);
      if (!ok) {
        res.status(200).json({
          src,
          debug: {
            ffmpegError: result.error ?? 'output missing',
            binary: result.binary,
            cwd: process.cwd()
          }
        }); // graceful degradation
        return;
      }
      const fixedSrc = await uploadBufferToR2(
        `media/normalized/${uid}/${sha256Hex(src).slice(0, 20)}.mp4`,
        'video/mp4',
        readFileSync(outputPath)
      );
      if (!fixedSrc) {
        res.status(200).json({ src });
        return;
      }
      await writeMediaCache(cacheKey, src, fixedSrc);
      res.status(200).json({ src: fixedSrc });
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  } catch {
    res.status(200).json({ src }); // Never break playback because of repair.
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' }
  }
};
