import { getFirebaseConfig } from '@lib/firebase/config';

export async function verifyAccountPassword(
  email: string,
  password: string
): Promise<boolean> {
  if (!email || !password) return false;
  const apiKey = getFirebaseConfig().apiKey;
  if (!apiKey) return false;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false
      })
    }
  );

  return response.ok;
}
