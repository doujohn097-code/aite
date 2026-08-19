import admin, { ServiceAccount } from 'firebase-admin';

function getServiceAccount(): ServiceAccount {
  const key = process.env.FIREBASE_ADMIN_KEY;
  if (!key) throw new Error('FIREBASE_ADMIN_KEY is missing');
  return JSON.parse(Buffer.from(key, 'base64').toString('utf8')) as ServiceAccount;
}

export const firebaseAdmin =
  admin.apps.length === 0
    ? admin.initializeApp({
        credential: admin.credential.cert(getServiceAccount())
      })
    : admin.app();

export const adminAuth = firebaseAdmin.auth();
export const adminFirestore = firebaseAdmin.firestore();
