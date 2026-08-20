import admin from 'firebase-admin';

type ServiceAccountJson = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
};

const base64ServiceAccount = process.env.FIREBASE_ADMIN_KEY;

if (!base64ServiceAccount) {
  throw new Error('Missing FIREBASE_ADMIN_KEY environment variable');
}

const serviceAccountJson = Buffer.from(base64ServiceAccount, 'base64').toString(
  'utf8'
);
const parsed = JSON.parse(serviceAccountJson) as ServiceAccountJson;

const serviceAccount: admin.ServiceAccount = {
  projectId: parsed.project_id,
  clientEmail: parsed.client_email,
  privateKey: parsed.private_key
};

if (!admin.apps.length)
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId
  });

export const authAdmin = admin.auth();

export async function verifyIdToken(
  token: string
): Promise<admin.auth.DecodedIdToken> {
  return authAdmin.verifyIdToken(token);
}
