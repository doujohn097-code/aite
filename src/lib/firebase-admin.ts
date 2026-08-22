import admin from 'firebase-admin';

type ServiceAccountJson = {
  project_id: string;
  private_key: string;
  client_email: string;
};

function getServiceAccount(): admin.ServiceAccount {
  const encoded = process.env.FIREBASE_ADMIN_KEY;
  if (!encoded) throw new Error('FIREBASE_ADMIN_KEY is missing');

  let parsed: ServiceAccountJson;
  try {
    parsed = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf8')
    ) as ServiceAccountJson;
  } catch {
    throw new Error('FIREBASE_ADMIN_KEY is not valid base64 JSON');
  }

  if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
    throw new Error('FIREBASE_ADMIN_KEY is missing required fields');
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key
  };
}

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccount = getServiceAccount();
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId
  });
}

// This is the only server-side Firebase Admin entry point. It deliberately
// uses the same service account/project as the client Firebase app so all API
// routes and background helpers stay on the single Firestore database.
const firebaseAdmin = getAdminApp();

export const adminAuth = firebaseAdmin.auth();
export const adminFirestore = firebaseAdmin.firestore();

export async function verifyIdToken(
  token: string
): Promise<admin.auth.DecodedIdToken> {
  return adminAuth.verifyIdToken(token);
}
