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
 * The linux x64 ffmpeg binary is committed at src/pages/api/media/ffmpeg-bin
 * and referenced with literal paths so Next's file tracing (nft) packages it
 * into the serverless functions. Vercel blocks npm install scripts, so we
 * cannot rely on ffmpeg-static's postinstall download, and `includeFiles` is
 * ignored for Next.js functions — the nft trace is the packaging manifest.
 *
 * Both the existsSync anchor and the execFile call use the same literal
 * `join(__dirname, 'ffmpeg-bin', 'ffmpeg')` expression, which nft evaluates.
 */
export async function execFfmpeg(args: string[]): Promise<boolean> {
  const ffmpegPath = join(__dirname, 'ffmpeg-bin', 'ffmpeg');
  if (!existsSync(ffmpegPath)) return false;
  try {
    await execFileAsync(ffmpegPath, args, {
      timeout: FFMPEG_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      killSignal: 'SIGKILL'
    });
    return true;
  } catch {
    return false;
  }
}

export async function downloadToFile(
  url: string,
  filePath: string
): Promise<void> {
  const response = await fetch(url, { headers: { Range: 'bytes=0-' } });
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
