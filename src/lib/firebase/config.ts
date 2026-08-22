/**
 * Firebase config - موحد على مشروع واحد myapp-5a04d
 * تم إصلاح مشكلة سابقة حيث كانت NEXT_PUBLIC_PROJECT_ID = aite-76 بينما apiKey لمشروع myapp-5a04d
 * مما كان يسبب فشل التسجيل.
 */

const FALLBACK = {
  apiKey: 'AIzaSyAceIDZarR6VUAxhOJHn2hNa_MYPSLUQzg',
  authDomain: 'myapp-5a04d.firebaseapp.com',
  projectId: 'myapp-5a04d',
  messagingSenderId: '143118795591',
  appId: '1:143118795591:web:e01c3b800cd15afe018262',
  measurementId: 'G-G4G100CBSK'
} as const;

function pickEnv(...keys: (string | undefined)[]): string | undefined {
  for (const k of keys) {
    if (k && k.trim() !== '') return k.trim();
  }
  return undefined;
}

const raw = {
  apiKey: pickEnv(
    process.env.FIREBASE_API_KEY,
    process.env.NEXT_PUBLIC_API_KEY,
    FALLBACK.apiKey
  )!,
  authDomain: pickEnv(
    process.env.FIREBASE_AUTH_DOMAIN,
    process.env.NEXT_PUBLIC_AUTH_DOMAIN,
    FALLBACK.authDomain
  )!,
  projectId: pickEnv(
    process.env.FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_PROJECT_ID,
    FALLBACK.projectId
  )!,
  messagingSenderId: pickEnv(
    process.env.FIREBASE_MESSAGING_SENDER_ID,
    process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
    FALLBACK.messagingSenderId
  )!,
  appId: pickEnv(
    process.env.FIREBASE_APP_ID,
    process.env.NEXT_PUBLIC_APP_ID,
    FALLBACK.appId
  )!,
  measurementId: pickEnv(
    process.env.FIREBASE_MEASUREMENT_ID,
    process.env.NEXT_PUBLIC_MEASUREMENT_ID,
    FALLBACK.measurementId
  )!
};

// تحقق من التناسق - إذا كان projectId مختلفًا عن المتوقع، نستخدم fallback
// هذا يمنع مشكلة aite-76 vs myapp-5a04d
const KNOWN_PROJECTS = new Set(['myapp-5a04d']);
if (!KNOWN_PROJECTS.has(raw.projectId)) {
  // في الإنتاج، إذا كان projectId غير معروف، نستخدم myapp-5a04d كافتراضي آمن
  // مع تسجيل تحذير للمطور
  if (typeof window !== 'undefined') {
    console.warn(
      `[Firebase] projectId "${raw.projectId}" غير متوقع، سيتم استخدام "${FALLBACK.projectId}" بدلاً منه. تحقق من متغيرات البيئة في Vercel.`
    );
  }
  // نصحح فقط إذا كان apiKey يشير إلى myapp-5a04d
  if (raw.apiKey === FALLBACK.apiKey) {
    raw.projectId = FALLBACK.projectId;
    raw.authDomain = FALLBACK.authDomain;
    raw.messagingSenderId = FALLBACK.messagingSenderId;
    raw.appId = FALLBACK.appId;
  }
}

const config = raw as typeof FALLBACK;

type Config = typeof config;

export function getFirebaseConfig(): Config {
  return config;
}
