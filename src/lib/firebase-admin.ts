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

function parseServiceAccount(
  base64Value: string | undefined,
  fallbackProjectId: string
): admin.ServiceAccount | null {
  if (!base64Value) return null;
  try {
    const serviceAccountJson = Buffer.from(base64Value, 'base64').toString(
      'utf8'
    );
    const parsed = JSON.parse(serviceAccountJson) as ServiceAccountJson;
    if (!parsed.private_key || !parsed.client_email) return null;
    return {
      projectId: parsed.project_id ?? fallbackProjectId,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key
    };
  } catch {
    return null;
  }
}

function initializeAdmin(
  appName: string | undefined,
  base64Key: string | undefined,
  fallbackProjectId: string
): admin.app.App {
  const existing = admin.apps.find(
    (app) => app && (appName ? app.name === appName : app.name === '[DEFAULT]')
  );
  if (existing) return existing;

  const serviceAccount =
    parseServiceAccount(base64Key, fallbackProjectId) ?? undefined;
  return admin.initializeApp(
    {
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount)
        : admin.credential.applicationDefault(),
      projectId: serviceAccount?.projectId ?? fallbackProjectId
    },
    appName
  );
}

/** Primary Firebase project (myapp-5a04d) — the platform's default. */
export function getAdminAppA(): admin.app.App {
  return initializeAdmin(
    undefined,
    process.env.FIREBASE_ADMIN_KEY,
    process.env.FIREBASE_PROJECT_ID || 'myapp-5a04d'
  );
}

/** Secondary Firebase project (aite-76) — round-robin partner. */
export function getAdminAppB(): admin.app.App | null {
  if (!process.env.FIREBASE_ADMIN_KEY_B) return null;
  return initializeAdmin(
    'aiteB',
    process.env.FIREBASE_ADMIN_KEY_B,
    process.env.FIREBASE_PROJECT_ID_B || 'aite-76'
  );
}

export const authAdmin = getAdminAppA().auth();
export const firestoreAdmin = getAdminAppA().firestore();

export type ProjectId = 'a' | 'b';

/** Resolves an admin app for a round-robin project key. */
export function adminAppForProject(project: ProjectId): admin.app.App | null {
  if (project === 'b') return getAdminAppB();
  return getAdminAppA();
}

/** Verifies an ID token against the primary project. */
export async function verifyIdToken(
  token: string
): Promise<admin.auth.DecodedIdToken> {
  return authAdmin.verifyIdToken(token);
}

/**
 * Verifies an ID token against either project (users live in both). Returns
 * the decoded token plus the project the account belongs to.
 */
export async function verifyIdTokenAny(
  token: string
): Promise<{ decoded: admin.auth.DecodedIdToken; project: ProjectId }> {
  try {
    const decoded = await authAdmin.verifyIdToken(token);
    return { decoded, project: 'a' };
  } catch {
    const adminB = getAdminAppB();
    if (adminB) {
      const decoded = await adminB.auth().verifyIdToken(token);
      return { decoded, project: 'b' };
    }
    throw new Error('unauthorized');
  }
}
