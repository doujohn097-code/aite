import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { isUsingEmulator } from '@lib/env';
import { getFirebaseConfig } from './config';
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

function connectToEmulator({ auth, firestore, functions, firebaseApp }: Firebase): Firebase {
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
