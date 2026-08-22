# نشر Aite بعد التحسينات

## 1. البيئة

انسخ `.env.example` إلى `.env.local` وأدخل إعدادات Firebase وR2. لا ترفع `.env.local` أو مفتاح حساب الخدمة إلى GitHub.

## 2. قواعد Firebase

```bash
npm i -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
```

## 3. لوحة الإدارة

لوحة `/admin` تعتمد فقط على Firebase Custom Claims. عيّنها من بيئة آمنة:

```bash
FIREBASE_ADMIN_KEY="BASE64_SERVICE_ACCOUNT_JSON" node scripts/set-admin.mjs USER_UID
```

يجب على المستخدم تسجيل الخروج ثم الدخول كي يحصل على التوكن الجديد. لا تضف حقل `admin` إلى وثائق المستخدمين؛ قواعد Firestore لا تثق به.

## 4. Cloudflare R2

- أنشئ CORS للحاوية من لوحة Cloudflare أو IaC، مع `AllowedOrigins` لنطاقاتك الفعلية فقط.
- السماح المطلوب: `PUT` و`GET`، ورأس `Content-Type`.
- روابط الرفع الموقعة صالحة لدقيقتين فقط.

## 5. التحقق قبل النشر

```bash
npm ci
npm run lint
npm run test:ci
npm run build
```

## ملاحظات أمنية

- ملفات الوسائط محددة بـ50MB في العميل وCloudflare R2.
- الرفع يتم حصريًا عبر روابط R2 الموقّعة؛ لا توجد Firebase Storage كطبقة احتياطية.
- لا تنشر القواعد قبل اختبارها على Firebase Emulator إذا كانت لديك بيانات إنتاجية حساسة.
