/** @type {import('next').NextConfig} */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://www.recaptcha.net${
    process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
  }`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com wss://*.googleapis.com https://*.firebaseapp.com https://*.r2.cloudflarestorage.com https://pub-*.r2.dev https://www.google.com https://www.gstatic.com https://www.recaptcha.net",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.firebaseapp.com https://www.google.com https://www.gstatic.com https://recaptcha.google.com https://www.recaptcha.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests'
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: false
  },
  images: {
    unoptimized: true
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups'
          },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload'
                }
              ]
            : []),
          // في التطوير نسمح بالتضمين داخل إطار المعاينة فقط
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'X-Frame-Options', value: 'DENY' }]
            : []),
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()'
          }
        ]
      }
    ];
  },
  env: {
    // استخدام القيم من البيئة مع fallback آمن - تم إصلاح مشكلة projectId غير متطابق
    FIREBASE_API_KEY:
      process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_API_KEY,
    FIREBASE_AUTH_DOMAIN:
      process.env.FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID:
      process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_PROJECT_ID,
    FIREBASE_MESSAGING_SENDER_ID:
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID:
      process.env.FIREBASE_APP_ID || process.env.NEXT_PUBLIC_APP_ID,
    FIREBASE_MEASUREMENT_ID:
      process.env.FIREBASE_MEASUREMENT_ID ||
      process.env.NEXT_PUBLIC_MEASUREMENT_ID,
    FIREBASE_STORAGE_BUCKET:
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_STORAGE_BUCKET,
    FIREBASE_USE_EMULATOR: process.env.FIREBASE_USE_EMULATOR,
    SITE_URL:
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  }
};

module.exports = nextConfig;
