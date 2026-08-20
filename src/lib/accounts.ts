export type SavedAccount = {
  username: string;
  /** Empty for Google accounts — they re-authenticate via the Google popup. */
  password: string;
  name: string;
  photoURL: string | null;
  provider?: 'password' | 'google';
  savedAt: number;
};

const STORAGE_KEY = 'aite:saved-accounts';
const MAX_ACCOUNTS = 8;

function isValidAccount(value: unknown): value is SavedAccount {
  if (typeof value !== 'object' || value === null) return false;
  const account = value as Record<string, unknown>;
  return (
    typeof account.username === 'string' &&
    typeof account.password === 'string' &&
    typeof account.name === 'string' &&
    (typeof account.photoURL === 'string' || account.photoURL === null) &&
    (account.provider === undefined ||
      account.provider === 'password' ||
      account.provider === 'google')
  );
}

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidAccount).slice(0, MAX_ACCOUNTS);
  } catch {
    return [];
  }
}

export function hasSavedAccounts(): boolean {
  return getSavedAccounts().length > 0;
}

export function saveAccount(account: Omit<SavedAccount, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  const rest = getSavedAccounts().filter(
    (saved) => saved.username !== account.username
  );
  const next = [{ ...account, savedAt: Date.now() }, ...rest].slice(
    0,
    MAX_ACCOUNTS
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function removeSavedAccount(username: string): void {
  if (typeof window === 'undefined') return;
  const next = getSavedAccounts().filter(
    (saved) => saved.username !== username
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
