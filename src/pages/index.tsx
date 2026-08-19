import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthLayout } from '@components/layout/auth-layout';
import { SEO } from '@components/common/seo';
import { LoginMain } from '@components/login/login-main';
import { LoginFooter } from '@components/login/login-footer';
import { hasSavedAccounts } from '@lib/accounts';
import type { ReactElement, ReactNode } from 'react';

export default function Login(): JSX.Element {
  const { replace, query, isReady } = useRouter();

  useEffect(() => {
    if (!isReady) return;

    const redirect =
      typeof query.redirect === 'string'
        ? `?redirect=${encodeURIComponent(query.redirect)}`
        : '';

    if (window.sessionStorage.getItem('aite:post-logout')) {
      window.sessionStorage.removeItem('aite:post-logout');
      void replace(`/accounts${redirect}`);
      return;
    }

    if (!('manual' in query) && hasSavedAccounts())
      void replace(`/accounts${redirect}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
  return (
    <div className='grid min-h-screen grid-rows-[1fr,auto]'>
      <SEO
        title='Aite - تواصل بشكل أنيق مع الجميع'
        description='شارك أفكارك وتابع الآخرين في Aite.'
      />
      <LoginMain />
      <LoginFooter />
    </div>
  );
}

Login.getLayout = (page: ReactElement): ReactNode => (
  <AuthLayout>{page}</AuthLayout>
);
