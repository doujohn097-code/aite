import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  enableMultiTabIndexedDbPersistence
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { isUsingEmulator } from '@lib/env';
import { getFirebaseConfig } from './config';
import { maybeInitAppCheck } from './app-check';
import type { Auth } from 'firebase/auth';
import type { Functions } from 'firebase/functions';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

type Firebase = {
  auth: Auth;
  firestore: Firestore;
  functions: Functions;
  firebaseApp: FirebaseApp;
};

function initialize(): Firebase {
  const firebaseApp = initializeApp(getFirebaseConfig());
  maybeInitAppCheck(firebaseApp);
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  // جلسة دائمة وذاكرة Firestore محلية: عند العودة من الخلفية تظهر آخر حالة
  // سليمة فورًا بدل شاشة فارغة أثناء إعادة الاتصال.
  void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  if (typeof window !== 'undefined')
    void enableMultiTabIndexedDbPersistence(firestore).catch(() => undefined);
  return {
    firebaseApp,
    auth,
    firestore,
    functions: getFunctions(firebaseApp)
  };
}

function connectToEmulator({
  auth,
  firestore,
  functions,
  firebaseApp
}: Firebase): Firebase {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  return { firebaseApp, auth, firestore, functions };
}

export function getFirebase(): Firebase {
  const firebase = initialize();
  return isUsingEmulator ? connectToEmulator(firebase) : firebase;
}

export const { firestore: db, auth } = getFirebase();
