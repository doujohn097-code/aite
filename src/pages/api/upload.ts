import { verifyIdToken, isAdminConfigured } from '@lib/firebase-admin';
import { getUploadUrl, isR2Configured } from '@lib/r2';
import { consumeRateLimit } from '@lib/server/rate-limit';
import { inferMediaType, maxUploadBytesForType } from '@lib/media-limits';
import type { NextApiRequest, NextApiResponse } from 'next';

const MAX_FILES = 8;
const MAX_FILE_NAME_LENGTH = 120;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp',
  'video/x-matroska',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/3gpp',
  'audio/opus'
]);

type UploadFile = { id: string; name: string; type: string; size: number };
type UploadResponseFile = UploadFile & {
  alt: string;
  uploadUrl: string;
  publicUrl: string;
};

function safeSegment(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, MAX_FILE_NAME_LENGTH);
}

function isValidFile(file: UploadFile): boolean {
  if (typeof file.name !== 'string' || typeof file.type !== 'string')
    return false;
  const mediaType = inferMediaType(file.name, file.type);
  return (
    typeof file.id === 'string' &&
    /^[a-zA-Z0-9_-]{6,80}$/.test(file.id) &&
    file.name.length > 0 &&
    file.name.length <= MAX_FILE_NAME_LENGTH &&
    ALLOWED_TYPES.has(mediaType) &&
    Number.isSafeInteger(file.size) &&
    file.size > 0 &&
    file.size <= maxUploadBytesForType(mediaType)
  );
}

export default async function uploadEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<{ files: UploadResponseFile[] } | { error: string }>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // فحص إعدادات الخادم قبل التحقق من التوكن
  if (!isAdminConfigured()) {
    console.error('FIREBASE_ADMIN_KEY missing');
    res
      .status(503)
      .json({ error: 'خدمة الرفع غير متاحة حاليًا — حاول مجددًا لاحقًا' });
    return;
  }

  if (!isR2Configured()) {
    console.error('R2 not configured');
    res
      .status(503)
      .json({ error: 'خدمة الرفع غير متاحة حاليًا — حاول مجددًا لاحقًا' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { uid } = await verifyIdToken(token);
    const rate = consumeRateLimit(`upload:${uid}`, 30, 60_000);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'طلبات رفع كثيرة — حاول بعد قليل' });
      return;
    }
    const { files } = req.body as { files?: UploadFile[] };
    if (
      !Array.isArray(files) ||
      files.length < 1 ||
      files.length > MAX_FILES ||
      !files.every(isValidFile)
    ) {
      res.status(400).json({
        error: 'الملف غير مدعوم أو يتجاوز الحد المسموح للحجم'
      });
      return;
    }
    const uploadedFiles = await Promise.all(
      files.map(async ({ id, name, type, size }) => {
        const safeName = safeSegment(name) || 'upload';
        const key = `media/${uid}/${id}-${safeName}`;
        const normalizedType = inferMediaType(name, type);
        const { uploadUrl, publicUrl } = await getUploadUrl(
          key,
          normalizedType
        );
        return {
          id,
          name,
          alt: name,
          type: normalizedType,
          size,
          uploadUrl,
          publicUrl
        };
      })
    );
    res.status(200).json({ files: uploadedFiles });
  } catch (error) {
    console.error('upload URL generation failed:', error);
    const msg =
      error instanceof Error ? error.message : 'Failed to generate upload URLs';
    // إرجاع رسالة واضحة للعميل
    res.status(500).json({ error: msg });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };
