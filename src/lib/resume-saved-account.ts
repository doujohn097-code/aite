import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@lib/firebase/app';
import { clearResumeToken, getResumeToken } from '@lib/account-session';
import { accountMatchesSession } from '@lib/saved-account';

export async function resumeSavedAccount(
  username: string,
  profileUsername?: string | null
): Promise<boolean> {
  const wanted = username.trim().toLowerCase();
  if (accountMatchesSession(wanted, profileUsername, auth.currentUser?.email))
    return true;

  const resumeToken = getResumeToken(wanted);
  if (!resumeToken) return false;

  const response = await fetch('/api/account/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: wanted, token: resumeToken })
  }).catch(() => null);
  const data = (await response?.json().catch(() => null)) as {
    token?: string;
  } | null;
  if (!response?.ok || !data?.token) {
    clearResumeToken(wanted);
    return false;
  }
  await signInWithCustomToken(auth, data.token);
  return true;
}
