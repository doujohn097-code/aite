const config = {
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
    'G-G4G100CBSK'
} as const;

type Config = typeof config;

export function getFirebaseConfig(): Config {
  return config;
}
