export type SavedAccount = {
  username: string;
  name: string;
  photoURL: string | null;
  provider?: 'password' | 'google';
  savedAt: number;
};

const STORAGE_KEY = 'aite:saved-accounts';
const MAX_ACCOUNTS = 8;

function toSafeAccount(value: unknown): SavedAccount | null {
  if (typeof value !== 'object' || value === null) return null;
  const account = value as Record<string, unknown>;
  if (
    typeof account.username !== 'string' ||
    typeof account.name !== 'string' ||
    (typeof account.photoURL !== 'string' && account.photoURL !== null) ||
    (account.provider !== undefined &&
      account.provider !== 'password' &&
      account.provider !== 'google')
  )
    return null;

  return {
    username: account.username,
    name: account.name,
    photoURL: account.photoURL,
    provider:
      account.provider === 'google' || account.provider === 'password'
        ? account.provider
        : 'password',
    savedAt: typeof account.savedAt === 'number' ? account.savedAt : Date.now()
  };
}

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    const safe = parsed
      .map(toSafeAccount)
      .filter((account): account is SavedAccount => account !== null)
      .slice(0, MAX_ACCOUNTS);

    // ترحيل أمني: الإصدارات القديمة خزنت كلمات المرور كنص صريح. نكتب فورًا
    // نسخة بيانات تعريفية فقط ونزيل أي password قديم من localStorage.
    const containedPassword = parsed.some(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        Object.prototype.hasOwnProperty.call(value, 'password')
    );
    if (containedPassword)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));

    return safe;
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
