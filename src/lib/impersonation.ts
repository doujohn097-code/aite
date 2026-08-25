export type ImpersonationSession = {
  userId: string;
  username: string;
  name: string;
};

export const IMPERSONATION_KEY = 'aite:impersonating';

export function readImpersonation(): ImpersonationSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(IMPERSONATION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ImpersonationSession>;
    if (
      typeof data.userId !== 'string' ||
      !data.userId ||
      typeof data.username !== 'string' ||
      !data.username
    )
      return null;
    return {
      userId: data.userId,
      username: data.username.trim().toLowerCase(),
      name:
        typeof data.name === 'string' && data.name.trim()
          ? data.name
          : data.username
    };
  } catch {
    return null;
  }
}

export function writeImpersonation(session: ImpersonationSession): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(session));
}

export function clearImpersonation(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(IMPERSONATION_KEY);
  } catch {
    // ignore
  }
}

export function isImpersonating(userId?: string | null): boolean {
  const session = readImpersonation();
  if (!session) return false;
  if (userId) return session.userId === userId;
  return true;
}

/** لا نربط إشعارات الجهاز بحساب ندخل إليه كمدير. */
export function shouldAttachPushToken(userId?: string | null): boolean {
  return !isImpersonating() && !isImpersonating(userId);
}
