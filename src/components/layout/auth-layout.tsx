import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';
import { isSafeInternalPath } from '@lib/utils';
import { Placeholder } from '@components/common/placeholder';
import type { LayoutProps } from './common-layout';

export function AuthLayout({ children }: LayoutProps): JSX.Element {
  const { user, loading } = useAuth();
  const { replace, isReady, query } = useRouter();

  useEffect(() => {
    if (!isReady || loading || !user) return;

    const redirect = Array.isArray(query.redirect)
      ? query.redirect[0]
      : query.redirect;

    const target = isSafeInternalPath(redirect)
      ? decodeURIComponent(redirect)
      : '/home';

    void replace(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isReady, query.redirect, replace]);

  // أثناء تحميل الجلسة أو وجود مستخدم (سنوجّهه فورًا) لا نعرض صفحات الدخول إطلاقًا
  if (loading || user) return <Placeholder />;

  return <>{children}</>;
}
