import { initializeApp, getApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  signInWithCustomToken
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { isUsingEmulator } from '@lib/env';
import { getFirebaseConfig } from './config';
import { otherProject } from '@lib/project-types';
import type { ProjectId } from '@lib/project-types';
import type { Auth } from 'firebase/auth';
import type { Functions } from 'firebase/functions';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

type FirebaseBundle = {
  auth: Auth;
  firestore: Firestore;
  functions: Functions;
  firebaseApp: FirebaseApp;
};

const PROJECT_KEY = 'aite:project';

export function readStoredProject(): ProjectId {
  if (typeof window === 'undefined') return 'a';
  const stored = window.localStorage.getItem(PROJECT_KEY);
  return stored === 'b' ? 'b' : 'a';
}

export function storeProject(project: ProjectId): void {
  try {
    if (typeof window !== 'undefined')
      window.localStorage.setItem(PROJECT_KEY, project);
  } catch {
    /* storage may be unavailable */
  }
}

function initialize(project: ProjectId): FirebaseBundle {
  const firebaseApp = initializeApp(
    getFirebaseConfig(project),
    `app-${project}`
  );
  const auth = getAuth(firebaseApp);
  // جلسة دائمة — يبقى المستخدم مسجلاً بعد إعادة التحميل.
  void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  return {
    firebaseApp,
    auth,
    firestore: getFirestore(firebaseApp),
    functions: getFunctions(firebaseApp)
  };
}

function connectToEmulator(bundle: FirebaseBundle): FirebaseBundle {
  connectAuthEmulator(bundle.auth, 'http://localhost:9099', {
    disableWarnings: true
  });
  connectFirestoreEmulator(bundle.firestore, 'localhost', 8080);
  connectFunctionsEmulator(bundle.functions, 'localhost', 5001);
  return bundle;
}

const bundles: Partial<Record<ProjectId, FirebaseBundle>> = {};

export function getFirebase(project: ProjectId): FirebaseBundle {
  let bundle = bundles[project];
  if (!bundle) {
    try {
      // Reuse an already-initialized app of this project (e.g. HMR).
      const existing = getApp(`app-${project}`);
      bundle = {
        firebaseApp: existing,
        auth: getAuth(existing),
        firestore: getFirestore(existing),
        functions: getFunctions(existing)
      };
    } catch {
      bundle = initialize(project);
    }
    bundles[project] = isUsingEmulator ? connectToEmulator(bundle) : bundle;
  }
  return bundle;
}

/** Primary project bundle — legacy default used by most of the app. */
export function getFirebaseA(): FirebaseBundle {
  return getFirebase('a');
}

/** Secondary (round-robin) project bundle. */
export function getFirebaseB(): FirebaseBundle {
  return getFirebase('b');
}

/** Signs the current app user into the OTHER project (same uid) so both
 * databases are readable/writable from any client. */
export async function signIntoPeer(ownProject: ProjectId): Promise<void> {
  const own = getFirebase(ownProject);
  const user = own.auth.currentUser;
  if (!user) return;
  const peer = getFirebase(otherProject(ownProject));
  if (peer.auth.currentUser?.uid === user.uid) return;
  try {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/auth/peer-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({})
    });
    if (!response.ok) return;
    const data = (await response.json()) as { token?: string };
    if (data.token) await signInWithCustomToken(peer.auth, data.token);
  } catch {
    // Peer access is best-effort; the app still works for the own project.
  }
}

export async function signOutBoth(project: ProjectId): Promise<void> {
  try {
    await getFirebase(project).auth.signOut();
  } catch {
    /* ignore */
  }
  try {
    await getFirebase(otherProject(project)).auth.signOut();
  } catch {
    /* ignore */
  }
}

/** The project the current session belongs to. */
export function getActiveProject(): ProjectId {
  return readStoredProject();
}

// Backward-compatible default bindings (primary project). The app's data
// layer keeps using these; dual-project code paths opt into getFirebase().
const defaultBundle = getFirebase('a');
export const auth = defaultBundle.auth;
export const db = defaultBundle.firestore;
export const functions = defaultBundle.functions;
export const firebaseApp = defaultBundle.firebaseApp;

/** The signed-in user of the ACTIVE (round-robin) project. */
export function getActiveAuthUser() {
  return getFirebase(getActiveProject()).auth.currentUser;
}
