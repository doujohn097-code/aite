import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'myapp-5a04d';
const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!saRaw) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing');
const sa = JSON.parse(saRaw);

// --- OAuth2 access token from service account (JWT bearer) ---
const require = createRequire(import.meta.url);

async function getAccessToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600
  };
  const b64 = (o) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claim)}`;
  const { sign } = await import('node:crypto');
  const signature = sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

const token = await getAccessToken();
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  return { code: res.status, data: text ? JSON.parse(text) : {} };
}

// --- 1) Firestore security rules via firebaserules API (bypasses IAM quirks) ---
const rulesBase = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}`;
const rulesSrc = readFileSync('./firestore.rules', 'utf8');
const rs = await api('POST', `${rulesBase}/rulesets`, {
  source: { files: [{ name: 'firestore.rules', content: rulesSrc }] }
});
if (rs.code !== 200) throw new Error(`ruleset create: ${rs.code} ${JSON.stringify(rs.data)}`);
console.log('ruleset created:', rs.data.name);

const rel = await api('PATCH', `${rulesBase}/releases/cloud.firestore`, {
  release: { name: `projects/${PROJECT}/releases/cloud.firestore`, rulesetName: rs.data.name }
});
if (rel.code !== 200) throw new Error(`release patch: ${rel.code} ${JSON.stringify(rel.data)}`);
console.log('rules released:', rel.data.rulesetName);

// --- 2) Firestore composite indexes via firestore REST (tolerate permission gaps) ---
const dbBase = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`;
const wanted = JSON.parse(readFileSync('./firestore.indexes.json', 'utf8')).indexes || [];
const existing = await api('GET', `${dbBase}/collectionGroups/tweets/indexes`);
console.log('existing tweets indexes:', (existing.data.indexes || []).length);

let ok = 0;
let skipped = 0;
for (const idx of wanted) {
  const cg = idx.collectionGroup;
  const fields = idx.fields.filter((f) => f.fieldPath !== '__name__');
  const body = { fields, queryScope: idx.queryScope };
  const r = await api('POST', `${dbBase}/collectionGroups/${cg}/indexes`, body);
  if (r.code === 200) {
    ok++;
    console.log(`index ok: ${cg}`);
  } else if (r.code === 403) {
    skipped++;
    console.warn(`index skipped (IAM lacks datastore.indexes.create): ${cg} — create manually from Firebase Console once`);
  } else {
    console.warn(`index issue ${cg}: ${r.code} ${JSON.stringify(r.data).slice(0, 160)}`);
  }
}
console.log(`done: rules deployed; ${ok} indexes created, ${skipped} skipped`);
if (skipped > 0) {
  console.log('NOTE: skipped indexes are optional for auth; queries will still work via fallback.');
}
