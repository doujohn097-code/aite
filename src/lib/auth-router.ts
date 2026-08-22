import { createHash, randomBytes } from 'crypto';
import {
  authAdmin,
  firestoreAdmin,
  getAdminAppB,
  adminAppForProject
} from './firebase-admin';
import type { ProjectId } from './firebase-admin';
import type { Timestamp } from 'firebase-admin/firestore';

export const PROJECTS: ProjectId[] = ['a', 'b'];

/**
 * Dual-database account router.
 *
 * New signups are assigned to the primary (myapp-5a04d) and secondary
 * (aite-76) Firebase projects in round-robin order so neither database takes
 * all the load. A public registry in the primary project maps every account
 * to its project; login looks it up and routes to the right project.
 */

/** Replicates the app's username -> internal email mapping. */
export function usernameToInternalEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  const base64 = Buffer.from(normalized, 'utf8').toString('base64url');
  const local = base64.slice(0, 60);
  return `${local}@aite.local`;
}

export function emailHashOf(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export function registryCollection() {
  return firestoreAdmin.collection('userRegistry');
}

/** Round-robin counter shared by every signup. */
async function nextProject(): Promise<ProjectId> {
  const counterRef = firestoreAdmin.doc('counters/registration');
  const result = await firestoreAdmin.runTransaction(async (tx) => {
    const snapshot = await tx.get(counterRef);
    const total = ((snapshot.data()?.total as number | undefined) ?? 0) + 1;
    tx.set(counterRef, { total }, { merge: true });
    return total;
  });
  // First new registration -> 'b' (so the freshly added database starts
  // receiving accounts right away), then alternates a, b, a, b, ...
  return result % 2 === 1 ? 'b' : 'a';
}

export async function writeRegistry(
  uid: string,
  username: string,
  email: string,
  project: ProjectId
): Promise<void> {
  await registryCollection()
    .doc(uid)
    .set({
      username: username.trim().toLowerCase(),
      emailHash: emailHashOf(email),
      project,
      createdAt: new Date()
    });
}

type RouteResult = { found: boolean; project?: ProjectId };

/** Finds which project an account lives on, by username or email. */
export async function routeAccount(identifier: string): Promise<RouteResult> {
  const cleaned = identifier.trim().toLowerCase();
  if (!cleaned) return { found: false };

  // 1) Registry lookup (fast path).
  try {
    const byUsername = await registryCollection()
      .where('username', '==', cleaned)
      .limit(1)
      .get();
    if (!byUsername.empty) {
      const project = byUsername.docs[0].data()?.project as
        | ProjectId
        | undefined;
      if (project === 'a' || project === 'b') return { found: true, project };
    }
    const byEmail = await registryCollection()
      .where('emailHash', '==', emailHashOf(cleaned))
      .limit(1)
      .get();
    if (!byEmail.empty) {
      const data = byEmail.docs[0].data() as { project?: unknown } | undefined;
      const project = data?.project;
      if (project === 'a' || project === 'b') return { found: true, project };
    }
  } catch {
    // Registry is best-effort; fall through to auth lookup.
  }

  // 2) Legacy accounts (created before the router) live in the primary
  // project; check both auth stores just in case.
  const email = cleaned.includes('@')
    ? cleaned
    : usernameToInternalEmail(cleaned);
  for (const project of PROJECTS) {
    const app = adminAppForProject(project);
    if (!app) continue;
    try {
      await app.auth().getUserByEmail(email);
      return { found: true, project };
    } catch {
      // not found — try the next project
    }
  }
  return { found: false };
}

export type SignupPayload = {
  username: string;
  password: string;
  name: string;
};

export type SignupResult = {
  project: ProjectId;
  email: string;
  uid: string;
};

/** Creates the account in the round-robin project and mirrors the app's
 * profile/stats documents exactly. */
export async function createAccount(
  payload: SignupPayload
): Promise<SignupResult> {
  const username = payload.username.trim().toLowerCase();
  const name = payload.name.trim().slice(0, 50);
  if (!username || !payload.password || !name)
    throw new Error('invalid_payload');
  if (!/^[a-z0-9_]{2,20}$/.test(username)) throw new Error('invalid_username');
  if (payload.password.length < 6) throw new Error('weak_password');

  const email = usernameToInternalEmail(username);

  // Username/email must be unique across BOTH projects.
  for (const project of PROJECTS) {
    const app = adminAppForProject(project);
    if (!app) continue;
    try {
      await app.auth().getUserByEmail(email);
      throw new Error('username_taken');
    } catch (error) {
      if ((error as Error).message === 'username_taken') throw error;
      // auth/user-not-found — free to use
    }
  }

  const project = await nextProject();
  const app = adminAppForProject(project);
  if (!app) throw new Error('project_unavailable');

  const uid = randomBytes(18).toString('base64url');
  const photoURL = '/assets/default-avatar.png';

  // photoURL must be an absolute URL in Firebase Auth; the profile document
  // keeps the app's relative default avatar instead.
  await app.auth().createUser({
    uid,
    email,
    password: payload.password,
    displayName: name
  });

  const projectFirestore = app.firestore();
  const now = new Date();

  await Promise.all([
    projectFirestore.doc(`users/${uid}`).set({
      id: uid,
      bio: null,
      name,
      theme: null,
      accent: null,
      website: null,
      location: null,
      photoURL,
      username,
      verified: false,
      following: [],
      followers: [],
      createdAt: now,
      updatedAt: now,
      totalTweets: 0,
      totalPhotos: 0,
      pinnedTweet: null,
      coverPhotoURL: null
    }),
    projectFirestore.doc(`users/${uid}/stats/stats`).set({
      likes: [],
      tweets: [],
      updatedAt: null
    })
  ]);

  await writeRegistry(uid, username, email, project);

  return { project, email, uid };
}

/** Mints a sign-in token for the OTHER project (same uid) so every client
 * can read/write both databases. */
export async function mintPeerToken(
  uid: string,
  ownProject: ProjectId
): Promise<string> {
  const peer: ProjectId = ownProject === 'a' ? 'b' : 'a';
  const app = adminAppForProject(peer);
  if (!app) throw new Error('peer_project_unavailable');
  return app.auth().createCustomToken(uid);
}

export type { Timestamp };
