<div align="center">

# Aite

منصة تواصل اجتماعي عربية مبنية بـ Next.js و TypeScript و Firebase

</div>

## المميزات ✨

- تسجيل الدخول باسم المستخدم وكلمة المرور أو بحساب Google
- حفظ عدة حسابات والتبديل بينها بلمسة واحدة
- نشر المنشورات مع الصور وملفات GIF
- نظام تعليقات متكامل مع ردود متداخلة
- الإعجاب وإعادة النشر والحفظ والتثبيت
- ريلز (فيديوهات قصيرة) وقصص (Stories)
- إشعارات فورية
- المتابعة وقوائم المتابِعين والمتابَعين
- البحث عن المستخدمين والمنشورات
- تعديل الملف الشخصي (الصورة، الغلاف، النبذة)
- واجهة عربية كاملة باتجاه RTL
- تصميم متجاوب للهاتف واللوحي وسطح المكتب
- تخصيص ألوان الموقع والخلفية

## التقنيات 🛠

- [Next.js](https://nextjs.org) + [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Firebase](https://firebase.google.com) — المصادقة و Firestore و Storage
- [Cloudflare R2](https://www.cloudflare.com/products/r2/) — رفع الوسائط
- [SWR](https://swr.vercel.app) · [Headless UI](https://headlessui.com) · [Framer Motion](https://framer.com)

## التشغيل محلياً 💻

1. استنساخ المشروع وتثبيت الحزم:

   ```bash
   git clone https://github.com/doujohn097-code/aite.git
   cd aite
   npm install
   ```

1. إنشاء مشروع Firebase وتفعيل الخدمات التالية:

   - **Authentication** — تفعيل طريقة Google
   - **Cloud Firestore** — إنشاء قاعدة بيانات
   - **Cloud Storage** — إنشاء حاوية تخزين

1. نسخ ملف البيئة وتعبئة القيم:

   ```bash
   cp .env.example .env.local
   ```

   ثم ضع إعدادات Firebase (ومفاتيح R2 لرفع الوسائط) داخل `.env.local`.

1. نشر قواعد وفهارس Firestore وStorage:

   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use your-project-id
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

1. **صلاحية لوحة الإدارة:** لا تُستخدم كلمة مرور ثابتة. عيّن Firebase Custom Claim للمسؤول (مرة واحدة)، ثم يخرج المسؤول ويدخل مجددًا:

   ```bash
   FIREBASE_ADMIN_KEY="<base64-service-account-json>" node scripts/set-admin.mjs USER_UID
   ```

   لا تضع مفتاح حساب الخدمة في GitHub. واضبط CORS لحاوية R2 من لوحة Cloudflare بحيث يسمح فقط بنطاق موقعك، وليس `*`.

1. تشغيل المشروع:

   ```bash
   npm run dev        # وضع التطوير
   npm run build      # بناء الإنتاج
   npm start          # تشغيل نسخة الإنتاج
   ```

> **ملاحظة:** قد تستغرق فهارس Firestore بضع دقائق لتصبح جاهزة بعد النشر.

## البنية 📁

```
src/
├── components/     # مكونات الواجهة
├── lib/            # السياقات والأدوات وإعدادات Firebase
├── pages/          # صفحات Next.js وواجهات API
└── styles/         # الأنماط والخطوط
```

---

صُنع بحب 🤍 من Salem Ahmed
