import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET_NAME;
const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

export function isR2Configured(): boolean {
  return !!(
    accountId &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    bucket &&
    publicBase
  );
}

function getClient(): S3Client {
  if (
    !accountId ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  )
    throw new Error('R2 غير مُكوَّن - تحقق من متغيرات البيئة R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

export async function getUploadUrl(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (!bucket || !publicBase)
    throw new Error('R2_BUCKET_NAME أو R2_PUBLIC_URL غير مُكوَّن');
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  });
  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: 120
  });
  return { uploadUrl, publicUrl: `${publicBase}/${encodeKey(key)}` };
}
