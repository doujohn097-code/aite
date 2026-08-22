import type { ProjectId } from '@lib/project-types';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  storageBucket?: string;
};

/** Primary Firebase project (myapp-5a04d) — legacy/default accounts. */
const configA: FirebaseConfig = {
  apiKey:
    process.env.FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_API_KEY ||
    'AIzaSyAceIDZarR6VUAxhOJHn2hNa_MYPSLUQzg',
  authDomain:
    process.env.FIREBASE_AUTH_DOMAIN ||
    process.env.NEXT_PUBLIC_AUTH_DOMAIN ||
    'myapp-5a04d.firebaseapp.com',
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_PROJECT_ID ||
    'myapp-5a04d',
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID ||
    '143118795591',
  appId:
    process.env.FIREBASE_APP_ID ||
    process.env.NEXT_PUBLIC_APP_ID ||
    '1:143118795591:web:e01c3b800cd15afe018262',
  measurementId:
    process.env.FIREBASE_MEASUREMENT_ID ||
    process.env.NEXT_PUBLIC_MEASUREMENT_ID ||
    'G-G4G100CBSK',
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET
};

/** Secondary Firebase project (aite-76) — round-robin partner. */
const configB: FirebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_API_KEY_B ||
    'AIzaSyAVCxXk6KQM9m--c5B973RJv-f1dlqVTJw',
  authDomain:
    process.env.NEXT_PUBLIC_AUTH_DOMAIN_B || 'aite-76.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID_B || 'aite-76',
  messagingSenderId:
    process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID_B || '260079907658',
  appId:
    process.env.NEXT_PUBLIC_APP_ID_B ||
    '1:260079907658:web:17e5a988e4614c1424c7b3',
  measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID_B || 'G-CQRDWWEPFF',
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET_B
};

const configs: Record<ProjectId, FirebaseConfig> = {
  a: configA,
  b: configB
};

export function getFirebaseConfig(project: ProjectId = 'a'): FirebaseConfig {
  return configs[project];
}
