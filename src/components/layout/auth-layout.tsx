import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';
import { isReadyProfile, isSafeInternalPath } from '@lib/utils';
import { Placeholder } from '@components/common/placeholder';
import type { LayoutProps } from './common-layout';

function hasPendingSignUp(): boolean {
  try {
    return !!window.sessionStorage.getItem('aite:pending-sign-up');
  } catch {
    return false;
  }
}

export function AuthLayout({ children }: LayoutProps): JSX.Element {
  const { user, loading } = useAuth();
  const { replace, isReady, query } = useRouter();
  const holdOnLogin = !!user && !isReadyProfile(user) && hasPendingSignUp();

  useEffect(() => {
    if (!isReady || loading || !user || holdOnLogin) return;

    const redirect = Array.isArray(query.redirect)
      ? query.redirect[0]
      : query.redirect;

    const target = isSafeInternalPath(redirect)
      ? decodeURIComponent(redirect)
      : '/home';

    void replace(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isReady, query.redirect, replace, holdOnLogin]);

  if (loading || (user && !holdOnLogin)) return <Placeholder />;

  return <>{children}</>;
}
