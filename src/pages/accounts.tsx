import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import {
  getSavedAccounts,
  hydrateSavedAccounts,
  removeSavedAccount
} from '@lib/accounts';
import { auth } from '@lib/firebase/app';
import { resumeSavedAccount } from '@lib/resume-saved-account';
import { accountMatchesSession } from '@lib/saved-account';
import { isSafeInternalPath } from '@lib/utils';
import { SEO } from '@components/common/seo';
import { AiteLogo } from '@components/ui/aite-logo';
import { UserAvatar } from '@components/user/user-avatar';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import type { SavedAccount } from '@lib/accounts';

export default function Accounts(): JSX.Element {
  const { user, loading: authLoading, signOut } = useAuth();
  const { t, isRtl } = useLanguage();
  const router = useRouter();

  const [accounts, setAccounts] = useState<SavedAccount[] | null>(null);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    setAccounts(getSavedAccounts());
    let cancelled = false;
    void hydrateSavedAccounts().then((next) => {
      if (!cancelled) setAccounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const getRedirectTarget = (): string => {
    const { redirect } = router.query;
    const target = Array.isArray(redirect) ? redirect[0] : redirect;
    return isSafeInternalPath(target) ? decodeURIComponent(target) : '/home';
  };

  const handlePick = async (account: SavedAccount): Promise<void> => {
    if (signingIn) return;
    if (
      accountMatchesSession(
        account.username,
        user?.username,
        auth.currentUser?.email
      )
    ) {
      await router.replace(getRedirectTarget());
      return;
    }
    setSigningIn(account.username);
    try {
      const opened = await resumeSavedAccount(account.username, user?.username);
      if (opened) {
        await router.replace(getRedirectTarget());
        return;
      }
    } catch {
      // نرجع لصفحة كلمة المرور
    }
    if (user) await signOut();
    await router.push({
      pathname: '/',
      query: {
        manual: '1',
        username: account.username,
        redirect: getRedirectTarget()
      }
    });
  };

  const handleRemove = (username: string): void => {
    removeSavedAccount(username);
    setAccounts((prev) => prev?.filter((a) => a.username !== username) ?? []);
    setRemoving(null);
    toast.success(t('ok.accountRemoved'));
  };

  if (authLoading || accounts === null) {
    return (
      <main className='flex min-h-app items-center justify-center'>
        <Loading className='mt-0' />
      </main>
    );
  }

  return (
    <main className='flex min-h-app flex-col items-center justify-center px-4 py-10'>
      <SEO title={t('accounts.title')} />
      <div className='flex w-full max-w-lg flex-col items-center gap-6'>
        <AiteLogo className='h-12 w-12' />

        <div className='flex flex-col items-center gap-1 text-center'>
          <h1 className='text-2xl font-bold text-light-primary dark:text-dark-primary'>
            {user ? t('accounts.switch') : t('accounts.choose')}
          </h1>
          <p className='text-sm text-light-secondary dark:text-dark-secondary'>
            {accounts.length ? t('accounts.saved') : t('accounts.none')}
          </p>
        </div>

        {!!accounts.length && (
          <ul className='flex w-full flex-col gap-2'>
            {accounts.map((account) => {
              const isCurrent = user?.username === account.username;
              return (
                <li key={account.username}>
                  <div
                    className={cn(
                      'flex w-full items-center gap-4 rounded-2xl border border-light-border p-4 transition dark:border-dark-border',
                      isCurrent
                        ? 'bg-main-accent/10 ring-1 ring-main-accent/40'
                        : 'bg-main-background hover:bg-light-primary/[0.04] dark:hover:bg-white/[0.04]'
                    )}
                  >
                    <button
                      type='button'
                      disabled={!!signingIn}
                      onClick={() => void handlePick(account)}
                      className='flex flex-1 items-center gap-3 text-start disabled:cursor-default'
                    >
                      <UserAvatar
                        src={account.photoURL || '/assets/default-avatar.png'}
                        alt={account.name || account.username}
                        username={account.username}
                        size={48}
                        disableLink
                      />
                      <span className='flex min-w-0 flex-1 flex-col'>
                        <span className='truncate text-[15px] font-bold text-light-primary dark:text-dark-primary'>
                          {account.name || account.username}
                          {isCurrent && (
                            <span className='mr-2 text-xs font-medium text-main-accent-text'>
                              ({t('common.currentAccount')})
                            </span>
                          )}
                        </span>
                        <span className='truncate text-xs text-light-secondary dark:text-dark-secondary'>
                          @{account.username}
                        </span>
                      </span>
                      {signingIn === account.username ? (
                        <Loading className='p-0' iconClassName='h-5 w-5' />
                      ) : (
                        !isCurrent && (
                          <HeroIcon
                            className='h-5 w-5 shrink-0 text-light-secondary dark:text-dark-secondary'
                            iconName={
                              isRtl ? 'ChevronLeftIcon' : 'ChevronRightIcon'
                            }
                          />
                        )
                      )}
                    </button>
                    {!isCurrent && (
                      <button
                        type='button'
                        aria-label={t('accounts.remove', {
                          username: account.username
                        })}
                        onClick={() =>
                          removing === account.username
                            ? handleRemove(account.username)
                            : setRemoving(account.username)
                        }
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold transition',
                          removing === account.username
                            ? 'bg-accent-red text-white'
                            : 'text-light-secondary hover:bg-accent-red/10 hover:text-accent-red dark:text-dark-secondary'
                        )}
                      >
                        {removing === account.username ? (
                          t('accounts.confirm')
                        ) : (
                          <HeroIcon className='h-4 w-4' iconName='TrashIcon' />
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className='flex w-full flex-col gap-2'>
          <Link
            href={`/?manual=1${
              router.query.redirect
                ? `&redirect=${encodeURIComponent(
                    String(router.query.redirect)
                  )}`
                : ''
            }`}
          >
            <a className='w-full'>
              <Button
                className='w-full border border-light-border py-2.5 font-bold text-light-primary
                           transition hover:bg-light-primary/[0.05] dark:border-dark-border
                           dark:text-dark-primary dark:hover:bg-white/[0.05]'
              >
                {accounts.length ? t('accounts.other') : t('accounts.login')}
              </Button>
            </a>
          </Link>
          {user && (
            <Link href='/home'>
              <a className='w-full'>
                <Button
                  className='w-full bg-main-accent py-2.5 font-bold text-main-accent-contrast transition
                             hover:brightness-90 active:brightness-75'
                >
                  {t('common.home')}
                </Button>
              </a>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
