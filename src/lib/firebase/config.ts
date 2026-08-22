const config = {
  apiKey:
    process.env.FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_API_KEY ||
    'AIzaSyAVCxXk6KQM9m--c5B973RJv-f1dlqVTJw',
  authDomain:
    process.env.FIREBASE_AUTH_DOMAIN ||
    process.env.NEXT_PUBLIC_AUTH_DOMAIN ||
    'aite-76.firebaseapp.com',
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_PROJECT_ID ||
    'aite-76',
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID ||
    '260079907658',
  appId:
    process.env.FIREBASE_APP_ID ||
    process.env.NEXT_PUBLIC_APP_ID ||
    '1:260079907658:web:17e5a988e4614c1424c7b3',
  measurementId:
    process.env.FIREBASE_MEASUREMENT_ID ||
    process.env.NEXT_PUBLIC_MEASUREMENT_ID ||
    'G-CQRDWWEPFF-CONFIG2026',
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_STORAGE_BUCKET ||
    'aite-76.firebasestorage.app'
} as const;

type Config = typeof config;

export function getFirebaseConfig(): Config {
  return config;
}
