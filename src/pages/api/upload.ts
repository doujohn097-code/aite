import { verifyIdTokenAny } from '@lib/firebase-admin';
import { getUploadUrl } from '@lib/r2';
import type { NextApiRequest, NextApiResponse } from 'next';

// Four user-selected videos can include four generated JPEG posters.
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
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac'
]);

type UploadFile = { id: string; name: string; type: string };
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

function normalizedMime(type: string): string {
  // MediaRecorder commonly returns values such as `audio/webm;codecs=opus`.
  // Validate the media type while preserving the complete value for the upload.
  return type.split(';', 1)[0].trim().toLowerCase();
}

function isValidFile(file: UploadFile): boolean {
  return (
    typeof file.id === 'string' &&
    /^[a-zA-Z0-9_-]{6,80}$/.test(file.id) &&
    typeof file.name === 'string' &&
    file.name.length > 0 &&
    file.name.length <= MAX_FILE_NAME_LENGTH &&
    typeof file.type === 'string' &&
    ALLOWED_TYPES.has(normalizedMime(file.type))
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
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { decoded: auth0 } = await verifyIdTokenAny(token);
    const uid = auth0.uid;
    const { files } = req.body as { files?: UploadFile[] };
    if (
      !Array.isArray(files) ||
      files.length < 1 ||
      files.length > MAX_FILES ||
      !files.every(isValidFile)
    ) {
      res.status(400).json({ error: 'Invalid media metadata' });
      return;
    }
    const uploadedFiles = await Promise.all(
      files.map(async ({ id, name, type }) => {
        const safeName = safeSegment(name) || 'upload';
        const key = `media/${uid}/${id}-${safeName}`;
        const { uploadUrl, publicUrl } = await getUploadUrl(key, type);
        return { id, name, alt: name, type, uploadUrl, publicUrl };
      })
    );
    res.status(200).json({ files: uploadedFiles });
  } catch (error) {
    console.error('upload URL generation failed:', error);
    res.status(500).json({ error: 'Failed to generate upload URLs' });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };
