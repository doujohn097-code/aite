/* Usage: FIREBASE_ADMIN_KEY="<base64 service-account-json>" node scripts/set-admin.mjs USER_UID */
import admin from 'firebase-admin';

const [uid] = process.argv.slice(2);
const encoded = process.env.FIREBASE_ADMIN_KEY;
if (!uid || !encoded) {
  console.error('Usage: FIREBASE_ADMIN_KEY="<base64 service-account-json>" node scripts/set-admin.mjs USER_UID');
  process.exit(1);
}
const account = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
admin.initializeApp({ credential: admin.credential.cert(account) });
await admin.auth().setCustomUserClaims(uid, { admin: true });
console.log(`Granted admin custom claim to ${uid}. The user must sign out and sign in again.`);
