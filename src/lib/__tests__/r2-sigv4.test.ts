import {
  buildSigV4HeaderAuth,
  buildSigV4PresignedUrl
} from '../r2';

/**
 * التحقق من صحة توقيع SigV4 بمقارنته بالأمثلة الرسمية المنشورة في وثائق
 * AWS — "Examples of the complete Signature Version 4 signing process".
 */
describe('sigv4 signer (AWS documentation vectors)', () => {
  test('header auth matches the documented get-vanilla example', () => {
    // المتجه الرسمي: GET https://example.amazonaws.com/ بخدمة service
    // ومنطقة us-east-1 وتاريخ 20150830T123600Z
    const { headers } = buildSigV4HeaderAuth({
      host: 'example.amazonaws.com',
      region: 'us-east-1',
      service: 'service',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      amzDate: '20150830T123600Z',
      method: 'GET',
      canonicalPath: '/',
      query: {},
      includeContentSha256Header: false
    });

    expect(headers.Authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31'
    );
  });

  test('presigned URL matches the documented S3 query-string example', () => {
    // المتجه الرسمي من وثائق S3 (Authenticating Requests: Using Query
    // Parameters) — test.txt في examplebucket بمنطقة us-east-1
    const url = buildSigV4PresignedUrl({
      host: 'examplebucket.s3.amazonaws.com',
      region: 'us-east-1',
      service: 's3',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      amzDate: '20130524T000000Z',
      method: 'GET',
      canonicalPath: '/test.txt',
      query: {},
      expiresInSeconds: 86400
    });

    expect(url).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt' +
        '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20130524T000000Z' +
        '&X-Amz-Expires=86400' +
        '&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
    );
  });
});
