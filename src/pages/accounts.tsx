import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import {
  getSavedAccounts,
  removeSavedAccount,
  saveAccount
} from '@lib/accounts';
import { usersCollection } from '@lib/firebase/collections';
import { SEO } from '@components/common/seo';
import { AiteLogo } from '@components/ui/aite-logo';
import { UserAvatar } from '@components/user/user-avatar';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import type { SavedAccount } from '@lib/accounts';

export default function Accounts(): JSX.Element {
  const { user, loading: authLoading, signInWithUsername } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = useState<SavedAccount[] | null>(null);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<
    Record<
      string,
      {
        photoURL: string;
        name: string;
        verified: boolean;
        gender?: string | null;
      }
    >
  >({});

  useEffect(() => {
    // حسابات Google القديمة لا تملك كلمة مرور — لا يمكن الدخول بها مباشرة فنخفيها
    const saved = getSavedAccounts().filter(
      (account) => account.provider !== 'google'
    );

    setAccounts(saved);

    // جلب الصور الحقيقية من قاعدة البيانات (المحفوظ محليًا قد يكون فارغًا)
    const usernames = saved.map(({ username }) => username).slice(0, 10);

    if (!usernames.length) return;

    void (async (): Promise<void> => {
      try {
        const snapshot = await getDocs(
          query(usersCollection, where('username', 'in', usernames))
        );

        const resolved: Record<
          string,
          {
            photoURL: string;
            name: string;
            verified: boolean;
            gender?: string | null;
          }
        > = {};

        snapshot.forEach((document) => {
          const data = document.data();
          resolved[data.username] = {
            photoURL: data.photoURL,
            name: data.name,
            verified: data.verified,
            gender: data.gender ?? null
          };

          // حدّث النسخة المحلية حتى تظهر الصورة فورًا في المرات القادمة
          const local = saved.find((item) => item.username === data.username);

          if (local && local.photoURL !== data.photoURL)
            saveAccount({
              username: local.username,
              password: local.password,
              name: data.name || local.name,
              photoURL: data.photoURL ?? null,
              provider: local.provider
            });
        });

        setProfiles(resolved);
      } catch {
        // تعذّر الجلب — نكتفي بالبيانات المحلية
      }
    })();
  }, []);

  const getRedirectTarget = (): string => {
    const { redirect } = router.query;
    const target = Array.isArray(redirect) ? redirect[0] : redirect;
    return typeof target === 'string' && target.startsWith('/')
      ? decodeURIComponent(target)
      : '/home';
  };

  const handlePick = async (account: SavedAccount): Promise<void> => {
    if (signingIn) return;
    setSigningIn(account.username);
    try {
      // دخول مباشر — Firebase يبدل الجلسة بهدوء دون الخروج المُسبَق (يمنع الغليتش)
      await signInWithUsername(account.username, account.password);
      if (typeof window !== 'undefined')
        window.sessionStorage.removeItem('aite:post-logout');
      await router.push(getRedirectTarget());
    } catch {
      toast.error('تعذر تسجيل الدخول بهذا الحساب — تحقق من كلمة المرور.');
    } finally {
      setSigningIn(null);
    }
  };

  const handleRemove = (username: string): void => {
    removeSavedAccount(username);
    setAccounts((prev) => prev?.filter((a) => a.username !== username) ?? []);
    setRemoving(null);
    toast.success('تمت إزالة الحساب من هذه القائمة');
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
      <SEO title='الحسابات المحفوظة / Aite' />
      <div className='flex w-full max-w-lg flex-col items-center gap-6'>
        <AiteLogo className='h-12 w-12' />

        <div className='flex flex-col items-center gap-1 text-center'>
          <h1 className='text-2xl font-bold text-light-primary dark:text-dark-primary'>
            {user ? 'تبديل الحساب' : 'اختر حساباً للمتابعة'}
          </h1>
          <p className='text-sm text-light-secondary dark:text-dark-secondary'>
            {accounts.length
              ? 'الحسابات التي سجلت الدخول بها على هذا الجهاز'
              : 'لا توجد حسابات محفوظة على هذا الجهاز بعد'}
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
                      disabled={!!signingIn || isCurrent}
                      onClick={() => void handlePick(account)}
                      className='flex flex-1 items-center gap-3 text-right disabled:cursor-default'
                    >
                      <UserAvatar
                        src={
                          profiles[account.username]?.photoURL ??
                          account.photoURL ??
                          '/assets/default-avatar.png'
                        }
                        alt={profiles[account.username]?.name ?? account.name}
                        username={account.username}
                        size={48}
                      />
                      <span className='flex min-w-0 flex-1 flex-col'>
                        <span className='truncate text-[15px] font-bold text-light-primary dark:text-dark-primary'>
                          {profiles[account.username]?.name ?? account.name}
                          {isCurrent && (
                            <span className='mr-2 text-xs font-medium text-main-accent-text'>
                              (الحساب الحالي)
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
                            iconName='ChevronLeftIcon'
                          />
                        )
                      )}
                    </button>
                    {!isCurrent && (
                      <button
                        type='button'
                        aria-label={`إزالة @${account.username} من القائمة`}
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
                          'تأكيد؟'
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
                {accounts.length ? 'استخدام حساب آخر' : 'تسجيل الدخول'}
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
                  العودة إلى الرئيسية
                </Button>
              </a>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
