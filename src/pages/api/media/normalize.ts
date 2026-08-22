import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  createWriteStream,
  existsSync,
  mkdtempSync,
  rmSync,
  readFileSync
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import admin from 'firebase-admin';
import { verifyIdToken } from '@lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

const execFileAsync = promisify(execFile);

const MAX_INPUT_BYTES = 250 * 1024 * 1024; // /tmp on Vercel is 500 MB
const TRANSCODE_TIMEOUT_MS = 50_000; // function itself allows up to 60 s

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET_NAME;
const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

function getR2Client(): S3Client | null {
  if (
    !accountId ||
    !bucket ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  )
    return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}

/** Only ever fetch media from the app's own R2 bucket. */
function isAllowedSource(src: string): boolean {
  if (!src || typeof src !== 'string' || src.length > 500) return false;
  if (publicBase && src.startsWith(`${publicBase}/`)) return true;
  // e.g. https://pub-ac6ca2c23fe44a8c93e7a74791c80260.r2.dev/media/...
  return /^https:\/\/pub-[a-f0-9]{32}\.r2\.dev\//.test(src);
}

type CacheDoc = {
  original: string;
  src: string;
  createdAt: admin.firestore.FieldValue;
};

function cacheRef(src: string): admin.firestore.DocumentReference {
  const key = createHash('sha256').update(src).digest('hex').slice(0, 48);
  return admin.firestore().collection('mediaCache').doc(key);
}

async function readCache(src: string): Promise<string | null> {
  try {
    const snapshot = await cacheRef(src).get();
    const data = snapshot.data() as Partial<CacheDoc> | undefined;
    if (data?.src && data.original === src) return data.src;
  } catch {
    // Cache is best-effort; never block playback on it.
  }
  return null;
}

async function writeCache(src: string, fixedSrc: string): Promise<void> {
  try {
    const cacheDoc: CacheDoc = {
      original: src,
      src: fixedSrc,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await cacheRef(src).set(cacheDoc);
  } catch {
    // Best-effort.
  }
}

async function downloadToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url, {
    headers: { Range: 'bytes=0-' }
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`download failed: ${response.status}`);
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_INPUT_BYTES) throw new Error('file too large');
  const body = response.body;
  if (!body) throw new Error('empty response body');
  await pipeline(Readable.fromWeb(body as never), createWriteStream(filePath));
  const size = existsSync(filePath)
    ? (await import('fs/promises')).stat(filePath).then((s) => s.size)
    : 0;
  if (size > MAX_INPUT_BYTES) throw new Error('file too large');
}

type TranscodeResult = { ok: boolean; filePath?: string };

async function runFfmpeg(
  inputPath: string,
  outputPath: string
): Promise<TranscodeResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const resolved = require('ffmpeg-static') as string | null;
  const candidates = [
    resolved,
    join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg')
  ];
  const ffmpegPath = candidates.find((p) => !!p && existsSync(p)) ?? null;
  if (!ffmpegPath) return { ok: false };

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

  try {
    await execFileAsync(ffmpegPath, args, {
      timeout: TRANSCODE_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      killSignal: 'SIGKILL'
    });
    return existsSync(outputPath)
      ? { ok: true, filePath: outputPath }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

async function uploadToR2(
  client: S3Client,
  uid: string,
  filePath: string,
  originalSrc: string
): Promise<string | null> {
  const sha = createHash('sha256')
    .update(originalSrc)
    .digest('hex')
    .slice(0, 20);
  const key = `media/normalized/${uid}/${sha}.mp4`;
  const publicKey = key.split('/').map(encodeURIComponent).join('/');
  try {
    if (!publicBase) return null;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: 'video/mp4',
        Body: readFileSync(filePath),
        CacheControl: 'public, max-age=31536000, immutable'
      })
    );
    return `${publicBase}/${publicKey}`;
  } catch {
    return null;
  }
}

export default async function normalizeMediaEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<{ src: string } | { error: string }>
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
    const cached = await readCache(src);
    if (cached) {
      res.status(200).json({ src: cached });
      return;
    }

    const client = getR2Client();
    if (!client) {
      res.status(200).json({ src }); // graceful degradation
      return;
    }

    const workDir = mkdtempSync(join(tmpdir(), 'aite-fix-'));
    const inputPath = join(workDir, 'input');
    const outputPath = join(workDir, 'fixed.mp4');
    try {
      await downloadToFile(src, inputPath);
      const transcode = await runFfmpeg(inputPath, outputPath);
      if (!transcode.ok || !transcode.filePath) {
        res.status(200).json({ src });
        return;
      }
      const fixedSrc = await uploadToR2(client, uid, transcode.filePath, src);
      if (!fixedSrc) {
        res.status(200).json({ src });
        return;
      }
      await writeCache(src, fixedSrc);
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
