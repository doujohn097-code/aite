import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';
import type { User } from '@lib/types/user';

export function useRequireAuth(): User | null {
  const { user, loading } = useAuth();
  const { replace, asPath, isReady } = useRouter();

  useEffect(() => {
    if (!isReady || loading || user) return;

    const returnPath = asPath && asPath !== '/' ? asPath : '/home';
    const target = `/?redirect=${encodeURIComponent(returnPath)}`;

    void replace(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isReady, asPath, replace]);

  return user;
}
