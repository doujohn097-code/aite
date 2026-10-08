// استيراد الخدمات الفرعية فقط (app/auth/firestore/messaging) بدل حزمة
// firebase-admin الكاملة — يقلّص حجم حزمة Workers بميغابايتات (بدون
// database وstorage وml وغيرها).
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldValue,
  getFirestore,
  initializeFirestore
} from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type { App, ServiceAccount } from 'firebase-admin/app';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';

export { FieldValue };

type ServiceAccountJson = {
  project_id: string;
  private_key: string;
  client_email: string;
};

function getServiceAccount(): ServiceAccount | null {
  const encoded = process.env.FIREBASE_ADMIN_KEY;
  if (!encoded) {
    console.warn(
      'FIREBASE_ADMIN_KEY is missing - server features requiring admin will fail'
    );
    return null;
  }

  let parsed: ServiceAccountJson;
  try {
    parsed = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf8')
    ) as ServiceAccountJson;
  } catch {
    console.error('FIREBASE_ADMIN_KEY is not valid base64 JSON');
    return null;
  }

  if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
    console.error('FIREBASE_ADMIN_KEY is missing required fields');
    return null;
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key
  };
}

function getAdminApp(): App | null {
  if (getApps().length > 0) return getApp();

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;

  try {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId
    });
  } catch (err) {
    console.error('Failed to initialize admin app', err);
    return null;
  }
}

// This is the only server-side Firebase Admin entry point.
const firebaseAdmin = getAdminApp();

let adminAuthInstance: Auth | null = null;
let adminFirestoreInstance: Firestore | null = null;

if (firebaseAdmin) {
  try {
    adminAuthInstance = getAuth(firebaseAdmin);
  } catch (err) {
    console.error('Failed to initialize admin auth', err);
  }
  try {
    // REST بدل gRPC: بيئات بدون دعم gRPC مثل Cloudflare Workers تعمل عبر REST.
    adminFirestoreInstance = initializeFirestore(firebaseAdmin, {
      preferRest: true
    });
  } catch (err) {
    console.error('Failed to initialize admin firestore', err);
    try {
      adminFirestoreInstance = getFirestore(firebaseAdmin);
    } catch (err2) {
      console.error('Failed to initialize admin firestore fallback', err2);
    }
  }
}

export const adminAuth = adminAuthInstance;
export const adminFirestore = adminFirestoreInstance;

export function requireAdminFirestore(): Firestore {
  if (!adminFirestoreInstance) {
    throw new Error('الخدمة غير متاحة حاليًا — حاول مجددًا لاحقًا');
  }
  return adminFirestoreInstance;
}

export function getAdminMessaging(): Messaging | null {
  if (!firebaseAdmin) return null;
  try {
    return getMessaging(firebaseAdmin);
  } catch {
    return null;
  }
}

export async function verifyIdToken(
  token: string
): Promise<DecodedIdToken> {
  if (!adminAuth) {
    throw new Error('الخدمة غير متاحة حاليًا — حاول مجددًا لاحقًا');
  }
  return adminAuth.verifyIdToken(token);
}

export function isAdminConfigured(): boolean {
  return !!firebaseAdmin && !!adminAuth;
}
