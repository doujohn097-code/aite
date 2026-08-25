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
  if (typeof account.username !== 'string' || !account.username.trim())
    return null;

  const username = account.username.trim().toLowerCase();
  const name =
    typeof account.name === 'string' && account.name.trim()
      ? account.name.trim()
      : username;
  const photoURL =
    typeof account.photoURL === 'string' && account.photoURL.trim()
      ? account.photoURL.trim()
      : null;
  if (
    account.provider !== undefined &&
    account.provider !== 'password' &&
    account.provider !== 'google'
  )
    return null;

  return {
    username,
    name,
    photoURL,
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

export type PublicSavedProfile = {
  username: string;
  name: string;
  photoURL: string | null;
};

export async function hydrateSavedAccounts(): Promise<SavedAccount[]> {
  const saved = getSavedAccounts();
  if (!saved.length) return saved;

  try {
    const usernames = saved.map((account) => account.username).join(',');
    const response = await fetch(
      `/api/account/profiles?usernames=${encodeURIComponent(usernames)}`
    );
    if (!response.ok) return saved;
    const data = (await response.json()) as {
      profiles?: PublicSavedProfile[];
    };
    const byUsername = new Map(
      (data.profiles ?? []).map((profile) => [profile.username, profile])
    );
    const next = saved.map((account) => {
      const live = byUsername.get(account.username);
      if (!live) return account;
      const merged: SavedAccount = {
        ...account,
        name: live.name || account.name,
        photoURL: live.photoURL || account.photoURL
      };
      if (
        merged.name !== account.name ||
        merged.photoURL !== account.photoURL
      )
        saveAccount({
          username: merged.username,
          name: merged.name,
          photoURL: merged.photoURL,
          provider: merged.provider
        });
      return merged;
    });
    return next;
  } catch {
    return saved;
  }
}
