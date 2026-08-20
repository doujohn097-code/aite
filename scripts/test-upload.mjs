import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const base64Key = process.env.FIREBASE_ADMIN_KEY;
if (!base64Key) throw new Error('FIREBASE_ADMIN_KEY missing');

const serviceAccountJson = Buffer.from(base64Key, 'base64').toString('utf8');
const parsed = JSON.parse(serviceAccountJson);

const serviceAccount = {
  projectId: parsed.project_id,
  clientEmail: parsed.client_email,
  privateKey: parsed.private_key
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId
  });
}

const auth = admin.auth();
const uid = 'test-user-' + Date.now();

await auth.createUser({
  uid,
  email: `${uid}@example.com`,
  displayName: 'Test User',
  photoURL:
    'https://pub-ac6ca2c23fe44a8c93e7a74791c80260.r2.dev/media/test/avatar.png'
});

const token = await auth.createCustomToken(uid);

const testImagePath = join(
  __dirname,
  '..',
  'public',
  'assets',
  'twitter-avatar.jpg'
);
const buffer = readFileSync(testImagePath);

const id = `${Date.now()}-test`;
const name = 'twitter-avatar.jpg';
const type = 'image/jpeg';

const response = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ files: [{ id, name, type }] })
});

if (!response.ok) {
  const text = await response.text();
  console.error('Upload URL request failed:', response.status, text);
  process.exit(1);
}

const { files } = await response.json();
const { uploadUrl, publicUrl } = files[0];

console.log('Upload URL:', uploadUrl.slice(0, 80), '...');
console.log('Public URL:', publicUrl);

const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': type },
  body: buffer
});

if (!uploadResponse.ok) {
  console.error(
    'R2 upload failed:',
    uploadResponse.status,
    await uploadResponse.text()
  );
  process.exit(1);
}

await new Promise((resolve) => setTimeout(resolve, 1000));

const publicResponse = await fetch(publicUrl);
if (publicResponse.status !== 200) {
  console.error('Public URL fetch failed:', publicResponse.status);
  process.exit(1);
}

console.log('R2 upload and public fetch succeeded.');

await auth.deleteUser(uid);

process.exit(0);
