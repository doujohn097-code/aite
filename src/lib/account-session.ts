const STORAGE_KEY = 'aite:account-sessions';

function readMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}'
    ) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    const next: Record<string, string> = {};
    for (const [username, token] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (
        /^[a-z0-9_]{3,15}$/.test(username) &&
        typeof token === 'string' &&
        token.length >= 20 &&
        token.length <= 200
      )
        next[username] = token;
    }
    return next;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getResumeToken(username: string): string | null {
  const key = username.trim().toLowerCase();
  return readMap()[key] ?? null;
}

export function setResumeToken(username: string, token: string): void {
  const key = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,15}$/.test(key) || !token) return;
  writeMap({ ...readMap(), [key]: token });
}

export function clearResumeToken(username: string): void {
  const key = username.trim().toLowerCase();
  const map = readMap();
  if (!(key in map)) return;
  delete map[key];
  writeMap(map);
}
