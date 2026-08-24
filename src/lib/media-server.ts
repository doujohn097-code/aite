import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createWriteStream, existsSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import admin from 'firebase-admin';

const execFileAsync = promisify(execFile);

export const MAX_INPUT_BYTES = 250 * 1024 * 1024; // /tmp on Vercel is 500 MB
export const FFMPEG_TIMEOUT_MS = 50_000; // function itself allows up to 60 s

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET_NAME;
const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

/** Only ever fetch media from the app's own R2 bucket. */
export function isAllowedSource(src: string): boolean {
  if (!src || typeof src !== 'string' || src.length > 500) return false;
  if (publicBase && src.startsWith(`${publicBase}/`)) return true;
  // e.g. https://pub-ac6ca2c23fe44a8c93e7a74791c80260.r2.dev/media/...
  return /^https:\/\/pub-[a-f0-9]{32}\.r2\.dev\//.test(src);
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function getR2Client(): S3Client | null {
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

/**
 * Candidate locations for the linux x64 ffmpeg binary, in priority order:
 * 1. committed binary (src/pages/api/media/ffmpeg-bin) next to the route
 * 2. ffmpeg-static package (binary copied into the traced output by
 *    scripts/copy-ffmpeg.mjs when the postinstall was allowed to run)
 * 3. repo-relative fallbacks
 */
export function findFfmpegCandidates(): string[] {
  let resolved: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    resolved = require('ffmpeg-static') as string | null;
  } catch {
    // The package may not be installed; the committed binary covers us.
  }
  return [
    join(__dirname, 'ffmpeg-bin', 'ffmpeg'),
    resolved,
    join(
      process.cwd(),
      '.next',
      'server',
      'node_modules',
      'ffmpeg-static',
      'ffmpeg'
    ),
    join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    join(process.cwd(), 'src', 'pages', 'api', 'media', 'ffmpeg-bin', 'ffmpeg')
  ].filter((p): p is string => !!p);
}

export function findFfmpegPath(): string | null {
  return findFfmpegCandidates().find((p) => existsSync(p)) ?? null;
}

export async function execFfmpeg(
  args: string[]
): Promise<{ ok: boolean; error?: string; binary?: string | null }> {
  const ffmpegPath = findFfmpegPath();
  if (!ffmpegPath) {
    return { ok: false, error: 'no ffmpeg binary found', binary: null };
  }
  try {
    await execFileAsync(ffmpegPath, args, {
      timeout: FFMPEG_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      killSignal: 'SIGKILL'
    });
    return { ok: true, binary: ffmpegPath };
  } catch (error) {
    return { ok: false, error: String(error), binary: ffmpegPath };
  }
}

export async function downloadToFile(
  url: string,
  filePath: string
): Promise<void> {
  const response = await fetch(url, {
    headers: {
      Range: 'bytes=0-',
      Accept: 'video/*,image/*;q=0.9,*/*;q=0.8',
      // Cloudflare's public R2 endpoint rejects some default server runtimes
      // with error 1010; use an explicit, stable media-processor identity.
      'User-Agent': 'Mozilla/5.0 (compatible; AiteMediaProcessor/1.1)'
    }
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`download failed: ${response.status}`);
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_INPUT_BYTES) throw new Error('file too large');
  const body = response.body;
  if (!body) throw new Error('empty response body');
  await pipeline(Readable.fromWeb(body as never), createWriteStream(filePath));
  const { stat } = await import('fs/promises');
  const size = existsSync(filePath) ? (await stat(filePath)).size : 0;
  if (size > MAX_INPUT_BYTES) throw new Error('file too large');
}

export async function uploadBufferToR2(
  key: string,
  contentType: string,
  body: Buffer
): Promise<string | null> {
  const client = getR2Client();
  if (!client || !bucket || !publicBase) return null;
  const publicKey = key.split('/').map(encodeURIComponent).join('/');
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        Body: body,
        CacheControl: 'public, max-age=31536000, immutable'
      })
    );
    return `${publicBase}/${publicKey}`;
  } catch {
    return null;
  }
}

type CacheDoc = {
  original: string;
  src: string;
  createdAt: admin.firestore.FieldValue;
};

export function mediaCacheRef(key: string): admin.firestore.DocumentReference {
  return admin.firestore().collection('mediaCache').doc(key);
}

export async function readMediaCache(
  key: string,
  original: string
): Promise<string | null> {
  try {
    const snapshot = await mediaCacheRef(key).get();
    const data = snapshot.data() as Partial<CacheDoc> | undefined;
    if (data?.src && data.original === original) return data.src;
  } catch {
    // Cache is best-effort; never block media on it.
  }
  return null;
}

export async function writeMediaCache(
  key: string,
  original: string,
  src: string
): Promise<void> {
  try {
    const cacheDoc: CacheDoc = {
      original,
      src,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await mediaCacheRef(key).set(cacheDoc);
  } catch {
    // Best-effort.
  }
}
