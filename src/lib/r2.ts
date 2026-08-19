import {
  S3Client,
  PutObjectCommand,
  PutBucketCorsCommand,
  type CORSConfiguration
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = 'auto';
const accountId = process.env.R2_ACCOUNT_ID as string;
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

const client = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string
  }
});

const bucket = process.env.R2_BUCKET_NAME as string;
const publicBase = process.env.R2_PUBLIC_URL as string;

let corsEnsured = false;

async function ensureCors(): Promise<void> {
  if (corsEnsured) return;

  const corsConfiguration: CORSConfiguration = {
    CORSRules: [
      {
        AllowedOrigins: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 3600
      }
    ]
  };

  try {
    await client.send(
      new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: corsConfiguration })
    );
    corsEnsured = true;
  } catch {
    // Best-effort: CORS may already be configured or credentials lack permission.
  }
}

function encodeKey(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function getUploadUrl(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  await ensureCors();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const publicUrl = `${publicBase}/${encodeKey(key)}`;

  return { uploadUrl, publicUrl };
}
