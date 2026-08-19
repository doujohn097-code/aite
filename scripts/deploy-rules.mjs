import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';

const env = readFileSync('./.env.local', 'utf8');
const base64Key = env.match(/^FIREBASE_ADMIN_KEY=(.+)$/m)?.[1]?.trim();
if (!base64Key) {
  console.error('Missing FIREBASE_ADMIN_KEY');
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(base64Key, 'base64').toString('utf8'));

const app = admin.default.initializeApp({
  credential: admin.default.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const source = await import('node:fs/promises').then(fs => fs.readFile('./firestore.rules', 'utf8'));

const result = await app.securityRules().releaseFirestoreRulesetFromSource(source);
console.log('Rules deployed:', result.name);
