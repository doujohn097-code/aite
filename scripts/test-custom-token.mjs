import { createSign } from 'crypto';
import { readFileSync } from 'fs';

const base64Key = process.env.FIREBASE_ADMIN_KEY;
const apiKey = process.env.NEXT_PUBLIC_API_KEY;

if (!base64Key || !apiKey) {
  console.error('Missing env');
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(base64Key, 'base64').toString('utf8'));

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const now = Math.floor(Date.now() / 1000);

const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const payload = base64UrlEncode(
  JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: `test-user-${now}`
  })
);

const sign = createSign('RSA-SHA256');
sign.update(`${header}.${payload}`);
const signature = sign.sign(serviceAccount.private_key, 'base64url');

const customToken = `${header}.${payload}.${signature}`;

console.log('API Key:', apiKey.slice(0, 10) + '...');
console.log('Custom token:', customToken.slice(0, 50) + '...');

const response = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  }
);

const data = await response.json();

if (!response.ok) {
  console.error('signInWithCustomToken failed:', response.status, data);
  process.exit(1);
}

console.log('Got idToken, length', data.idToken.length);

const id = `${Date.now()}-test`;
const uploadResponse = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.idToken}`
  },
  body: JSON.stringify({
    files: [{ id, name: 'twitter-avatar.jpg', type: 'image/jpeg' }]
  })
});

if (!uploadResponse.ok) {
  console.error('api/upload failed:', uploadResponse.status, await uploadResponse.text());
  process.exit(1);
}

const uploadData = await uploadResponse.json();
console.log('upload URL:', uploadData.files[0].uploadUrl.slice(0, 60) + '...');
console.log('public URL:', uploadData.files[0].publicUrl);

const buffer = readFileSync('public/assets/twitter-avatar.jpg');
const r2Response = await fetch(uploadData.files[0].uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: buffer
});

if (!r2Response.ok) {
  console.error('R2 upload failed:', r2Response.status, await r2Response.text());
  process.exit(1);
}

await new Promise((resolve) => setTimeout(resolve, 1000));

const publicResponse = await fetch(uploadData.files[0].publicUrl);
console.log('Public URL status:', publicResponse.status);

if (publicResponse.status !== 200) {
  console.error('Public URL fetch failed');
  process.exit(1);
}

console.log('Full flow succeeded.');
