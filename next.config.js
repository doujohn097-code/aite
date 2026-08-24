/** @type {import('next').NextConfig} */
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
