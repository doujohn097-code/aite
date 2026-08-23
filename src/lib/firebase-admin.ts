import admin from 'firebase-admin';

type ServiceAccountJson = {
  project_id: string;
  private_key: string;
  client_email: string;
};

function getServiceAccount(): admin.ServiceAccount | null {
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

function getAdminApp(): admin.app.App | null {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;

  try {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId
    });
  } catch (err) {
    console.error('Failed to initialize admin app', err);
    return null;
  }
}

// This is the only server-side Firebase Admin entry point.
const firebaseAdmin = getAdminApp();

export const adminAuth = firebaseAdmin?.auth() ?? null;
export const adminFirestore = firebaseAdmin?.firestore() ?? null;

export async function verifyIdToken(
  token: string
): Promise<admin.auth.DecodedIdToken> {
  if (!adminAuth) {
    throw new Error('الخدمة غير متاحة حاليًا — حاول مجددًا لاحقًا');
  }
  return adminAuth.verifyIdToken(token);
}

export function isAdminConfigured(): boolean {
  return !!firebaseAdmin && !!adminAuth;
}
