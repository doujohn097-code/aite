const config = {
  apiKey:
    process.env.FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_API_KEY ||
    'AIzaSyB1QrGTHaAcngO1nAfZXCQIucHZw2jjY7w',
  authDomain:
    process.env.FIREBASE_AUTH_DOMAIN ||
    process.env.NEXT_PUBLIC_AUTH_DOMAIN ||
    'gestion-67.firebaseapp.com',
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_PROJECT_ID ||
    'gestion-67',
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_STORAGE_BUCKET ||
    'gestion-67.firebasestorage.app',
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID ||
    '767393057625',
  appId:
    process.env.FIREBASE_APP_ID ||
    process.env.NEXT_PUBLIC_APP_ID ||
    '1:767393057625:web:a147c5c6ad4674866bda48',
  measurementId:
    process.env.FIREBASE_MEASUREMENT_ID ||
    process.env.NEXT_PUBLIC_MEASUREMENT_ID ||
    'G-08SNKRF8Q1'
} as const;

type Config = typeof config;

export function getFirebaseConfig(): Config {
  return config;
}
