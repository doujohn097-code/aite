import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} from '@aws-sdk/client-s3';
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
    throw new Error('خدمة التخزين غير متاحة حاليًا');
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
  if (!bucket || !publicBase) throw new Error('خدمة التخزين غير متاحة حاليًا');
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

/** حذف كل ملفات مستخدم من Cloudflare R2 (بادئات media/<uid>/ وmedia/normalized/<uid>/) */
export async function deleteUserMedia(userId: string): Promise<number> {
  if (!isR2Configured() || !bucket || !userId) return 0;

  const client = getClient();
  const prefixes = [`media/${userId}/`, `media/normalized/${userId}/`];

  let deleted = 0;

  for (const prefix of prefixes) {
    let continuationToken: string | undefined;

    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken
        })
      );

      const keys = (listed.Contents ?? [])
        .map(({ Key }) => Key)
        .filter((key): key is string => !!key);

      if (keys.length) {
        // R2 يقبل حتى 1000 مفتاح في الطلب الواحد
        for (let i = 0; i < keys.length; i += 1000) {
          const slice = keys.slice(i, i + 1000);
          await client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true }
            })
          );
          deleted += slice.length;
        }
      }

      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }

  return deleted;
}
