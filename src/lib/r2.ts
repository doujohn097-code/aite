/**
 * تخزين Cloudflare R2 — توقيع SigV4 يدوي بدون AWS SDK.
 *
 * السبب: حزم @aws-sdk تضيف ميغابايتات لحزمة الـ Worker وتكسر حد الخطة
 * المجانية. عملياتنا محدودة (روابط رفع/تنزيل موقّعة + حذف وسرد)، وكلها
 * ممكنة بتوقيع AWS Signature V4 مباشرة عبر node:crypto.
 */
import { createHash, createHmac } from 'crypto';
import { r2ObjectKeyFromPublicUrl } from '@lib/media-download';

const R2_REGION = 'auto';
const R2_SERVICE = 's3';

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
  );
}

function r2Host(): string {
  return `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

/** ترميز RFC 3986 المطلوب حرفياً في SigV4. */
export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/** يرمّز مفتاح الكائن للجزء المُسار (path) من الرابط مع الحفاظ على الشرطات. */
function encodeKey(key: string): string {
  return key.split('/').map(encodeRfc3986).join('/');
}

export type SigV4HeaderAuthConfig = {
  host: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  amzDate: string; // 20150830T123600Z
  method: string;
  canonicalPath: string; // يبدأ بـ /
  query: Record<string, string>;
  body?: string;
  /** عند false يوقّع host;x-amz-date فقط (يستخدم لمطابقة متجهات التوثيق). */
  includeContentSha256Header?: boolean;
};

/**
 * توقيع طلب بترويسات (Authorization header). دالة خالصة قابلة للاختبار —
 * مبنية حسب مواصفة AWS Signature Version 4.
 */
export function buildSigV4HeaderAuth(
  config: SigV4HeaderAuthConfig
): { headers: Record<string, string>; canonicalQuery: string } {
  const {
    host,
    region,
    service,
    accessKeyId,
    secretAccessKey,
    amzDate,
    method,
    canonicalPath,
    query,
    body,
    includeContentSha256Header = true
  } = config;

  const canonicalQuery = Object.entries(query)
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const payloadHash = sha256Hex(body ?? '');
  const canonicalHeaders = includeContentSha256Header
    ? `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    : `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = includeContentSha256Header
    ? 'host;x-amz-content-sha256;x-amz-date'
    : 'host;x-amz-date';

  const canonicalRequest = [
    method,
    canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const signingKey = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const headers: Record<string, string> = {
    'x-amz-date': amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
  if (includeContentSha256Header) headers['x-amz-content-sha256'] = payloadHash;
  return { headers, canonicalQuery };
}

function nowAmzDate(): string {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
}

export type SigV4PresignConfig = {
  host: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  amzDate: string;
  method: string;
  canonicalPath: string;
  query: Record<string, string>;
  expiresInSeconds: number;
  payloadHash?: string;
};

/** يولّد رابطاً موقّعاً مسبقاً (query auth) — دالة خالصة قابلة للاختبار. */
export function buildSigV4PresignedUrl(config: SigV4PresignConfig): string {
  const {
    host,
    region,
    service,
    accessKeyId,
    secretAccessKey,
    amzDate,
    method,
    canonicalPath,
    query: extraQuery,
    expiresInSeconds,
    payloadHash = 'UNSIGNED-PAYLOAD'
  } = config;
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
    ...extraQuery
  };


  const canonicalQuery = Object.entries(query)
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalRequest = [
    method,
    canonicalPath,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    payloadHash
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const signingKey = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex');

  return `https://${host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** يولّد رابطاً موقّعاً مسبقاً (query auth) لعملية على R2. */
function presign(
  method: 'PUT' | 'GET',
  key: string,
  extraQuery: Record<string, string>,
  expiresInSeconds: number
): string {
  return buildSigV4PresignedUrl({
    host: r2Host(),
    region: R2_REGION,
    service: R2_SERVICE,
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    amzDate: nowAmzDate(),
    method,
    canonicalPath: `/${process.env.R2_BUCKET_NAME}/${encodeKey(key)}`,
    query: extraQuery,
    expiresInSeconds
  });
}

export async function getUploadUrl(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  if (!process.env.R2_BUCKET_NAME || !publicBase || !process.env.R2_ACCOUNT_ID)
    throw new Error('خدمة التخزين غير متاحة حاليًا');
  // المقاطع الكبيرة قد تستغرق دقائق على شبكات الجوال
  const uploadUrl = presign('PUT', key, {}, 30 * 60);
  return { uploadUrl, publicUrl: `${publicBase}/${encodeKey(key)}` };
}

export async function getAttachmentDownloadUrl(
  src: string,
  filename: string
): Promise<string | null> {
  if (!isR2Configured()) return null;
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') as string;
  const bucket = process.env.R2_BUCKET_NAME as string;
  const key = r2ObjectKeyFromPublicUrl(src, { publicBase, bucket });
  if (!key) return null;
  const asciiName = filename.replace(/[^\w.-]+/g, '_') || 'aite-media';
  try {
    return presign(
      'GET',
      key,
      {
        'response-content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
          filename
        )}`,
        'response-content-type': 'application/octet-stream'
      },
      90
    );
  } catch {
    return null;
  }
}

/** حذف كل ملفات مستخدم من Cloudflare R2 (بادئات media/<uid>/ وmedia/normalized/<uid>/) */
export async function deleteUserMedia(userId: string): Promise<number> {
  if (!isR2Configured() || !userId) return 0;

  const host = r2Host();
  const bucket = process.env.R2_BUCKET_NAME as string;
  const auth = {
    host,
    region: R2_REGION,
    service: R2_SERVICE,
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string
  };

  const prefixes = [`media/${userId}/`, `media/normalized/${userId}/`];
  let deleted = 0;

  for (const prefix of prefixes) {
    let continuationToken: string | undefined;

    do {
      const listQuery: Record<string, string> = {
        'list-type': '2',
        prefix
      };
      if (continuationToken)
        listQuery['continuation-token'] = continuationToken;

      const { headers, canonicalQuery } = buildSigV4HeaderAuth({
        ...auth,
        amzDate: nowAmzDate(),
        method: 'GET',
        canonicalPath: `/${bucket}/`,
        query: listQuery
      });

      const response = await fetch(
        `https://${host}/${bucket}/?${canonicalQuery}`,
        { headers }
      );
      if (!response.ok) break;
      const xml = await response.text();

      const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
      continuationToken = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? [
            ...xml.matchAll(
              /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/g
            )
          ].pop()?.[1]
        : undefined;

      if (keys.length) {
        // R2 يقبل حتى 1000 مفتاح في الطلب الواحد
        for (let i = 0; i < keys.length; i += 1000) {
          const slice = keys.slice(i, i + 1000);
          const body = `<?xml version="1.0" encoding="UTF-8"?><Delete>${slice
            .map((k) => `<Object><Key>${k}</Key></Object>`)
            .join('')}<Quiet>true</Quiet></Delete>`;
          const { headers: deleteHeaders, canonicalQuery: deleteQuery } =
            buildSigV4HeaderAuth({
              ...auth,
              amzDate: nowAmzDate(),
              method: 'POST',
              canonicalPath: `/${bucket}/`,
              query: { delete: '' },
              body
            });
          const deleteResponse = await fetch(
            `https://${host}/${bucket}/?${deleteQuery}`,
            {
              method: 'POST',
              headers: { ...deleteHeaders, 'Content-Type': 'application/xml' },
              body
            }
          );
          if (deleteResponse.ok) deleted += slice.length;
        }
      }
    } while (continuationToken);
  }

  return deleted;
}
