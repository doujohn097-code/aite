import {
  emailsEqual,
  internalEmailToUsername,
  usernameToInternalEmail
} from '@lib/utils';

export function accountMatchesSession(
  username: string,
  profileUsername?: string | null,
  email?: string | null
): boolean {
  const wanted = username.trim().toLowerCase();
  if (!wanted) return false;
  if (profileUsername?.trim().toLowerCase() === wanted) return true;
  const fromEmail = internalEmailToUsername(email);
  if (fromEmail === wanted) return true;
  return emailsEqual(email, usernameToInternalEmail(wanted));
}
