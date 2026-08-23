import { useEffect, useState } from 'react';
import { auth } from '@lib/firebase/app';
import { useAuth } from '@lib/context/auth-context';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { Button } from '@components/ui/button';
import { Loading } from '@components/ui/loading';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { InputField } from '@components/input/input-field';
import { HeroIcon } from '@components/ui/hero-icon';
import type { ChangeEvent, FormEvent } from 'react';
import type { User } from '@lib/types/user';

const ADMIN_KEY_STORAGE = 'aite:admin-key';

export default function Admin(): JSX.Element {
  const { loading: authLoading } = useAuth();

  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  // استعادة الجلسة الإدارية داخل نفس التبويب فقط
  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (saved) setAdminKey(saved);
  }, []);

  const adminFetch = async (
    url: string,
    init: RequestInit = {},
    key = adminKey
  ): Promise<Response> => {
    const token = await auth.currentUser?.getIdToken().catch(() => undefined);

    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(key && { 'x-admin-key': key }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...init.headers
      }
    });
  };

  const fetchUsers = async (key = adminKey): Promise<void> => {
    if (!key) return;

    setLoading(true);
    setError(null);

    try {
      const response = await adminFetch('/api/admin/users', {}, key);
      const data = (await response.json()) as {
        users?: User[];
        error?: string;
      };

      if (!response.ok)
        throw new Error(data.error ?? 'لا تملك صلاحية الإدارة.');

      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && adminKey) void fetchUsers(adminKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, adminKey]);

  const handleUnlock = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    if (!password.trim() || unlocking) return;

    setUnlocking(true);
    setLockError(null);

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(data?.error ?? 'تعذر التحقق من كلمة السر');

      sessionStorage.setItem(ADMIN_KEY_STORAGE, password);
      setAdminKey(password);
      setPassword('');
    } catch (err) {
      setLockError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setUnlocking(false);
    }
  };

  const lock = (): void => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey(null);
    setUsers([]);
  };

  const toggleVerified = async (targetUser: User): Promise<void> => {
    setProcessing((prev) => ({ ...prev, [targetUser.id]: true }));

    try {
      const response = await adminFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({
          userId: targetUser.id,
          verified: !targetUser.verified
        })
      });

      if (!response.ok) throw new Error('تعذر تحديث حالة التحقق.');

      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, verified: !u.verified } : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setProcessing((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const deleteUser = async (targetUser: User): Promise<void> => {
    const confirmed = confirm(
      `حذف حساب ${targetUser.name} نهائيًا؟\n\nسيتم حذف: المنشورات والردود والإعجابات والقصص والريلز والمحادثات والرسائل والإشعارات وكل بياناته. لا يمكن التراجع.`
    );

    if (!confirmed) return;

    setProcessing((prev) => ({ ...prev, [targetUser.id]: true }));

    try {
      const response = await adminFetch('/api/admin/users', {
        method: 'DELETE',
        body: JSON.stringify({ userId: targetUser.id })
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) throw new Error(data?.error ?? 'تعذر حذف المستخدم.');

      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setProcessing((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  /* شاشة كلمة السر */
  if (!adminKey)
    return (
      <MainContainer>
        <SEO title='لوحة التحكم / Aite' />
        <MainHeader title='لوحة التحكم' />
        <section className='flex flex-col items-center gap-5 px-5 py-10'>
          <span
            className='flex h-16 w-16 items-center justify-center rounded-2xl
                       bg-main-accent/15 text-main-accent-text'
          >
            <HeroIcon className='h-8 w-8' iconName='LockClosedIcon' />
          </span>
          <div className='flex flex-col items-center gap-1 text-center'>
            <h2 className='text-xl font-bold'>منطقة محمية</h2>
            <p className='text-sm text-light-secondary dark:text-dark-secondary'>
              أدخل كلمة سر الإدارة للمتابعة
            </p>
          </div>
          <form
            className='flex w-full max-w-xs flex-col gap-3'
            onSubmit={(e): void => void handleUnlock(e)}
          >
            <InputField
              label='كلمة سر الإدارة'
              inputId='admin-password'
              type='password'
              inputValue={password}
              errorMessage={lockError ?? undefined}
              handleChange={({
                target: { value }
              }: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
                setPassword(value)
              }
            />
            <Button
              type='submit'
              className='bg-main-accent py-2.5 font-bold text-main-accent-contrast
                         transition hover:brightness-90 active:brightness-75'
              loading={unlocking}
              disabled={unlocking || !password.trim()}
            >
              دخول
            </Button>
          </form>
        </section>
      </MainContainer>
    );

  return (
    <MainContainer>
      <SEO title='لوحة التحكم / Aite' />
      <MainHeader title='لوحة التحكم' />
      <section className='flex flex-col'>
        <div className='flex items-start justify-between gap-3 border-b border-light-border px-5 py-4 dark:border-dark-border'>
          <div>
            <p className='font-bold'>إدارة المستخدمين</p>
            <p className='mt-1 text-sm text-light-secondary dark:text-dark-secondary'>
              حذف المستخدم يمسح كل بياناته نهائيًا.
            </p>
          </div>
          <Button
            className='shrink-0 rounded-full border border-light-border px-3 py-1.5 text-xs
                       font-bold transition hover:bg-light-primary/10
                       dark:border-dark-border dark:hover:bg-dark-primary/10'
            onClick={lock}
          >
            قفل
          </Button>
        </div>
        {loading ? (
          <Loading className='mt-5' />
        ) : error ? (
          <div className='m-5 rounded-2xl border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red'>
            <p>{error}</p>
            <Button
              className='mt-3 bg-main-accent px-4 py-2 font-bold text-main-accent-contrast'
              onClick={(): Promise<void> => fetchUsers()}
            >
              إعادة المحاولة
            </Button>
          </div>
        ) : users.length === 0 ? (
          <p className='p-8 text-center text-light-secondary dark:text-dark-secondary'>
            لا يوجد مستخدمون
          </p>
        ) : (
          users.map((targetUser) => (
            <div
              key={targetUser.id}
              className='hover-animation flex items-center justify-between gap-3 border-b border-light-border px-4 py-3 hover:bg-light-primary/5 dark:border-dark-border dark:hover:bg-dark-primary/5'
            >
              <div className='flex items-center gap-3 overflow-hidden'>
                <UserAvatar
                  src={targetUser.photoURL}
                  alt={targetUser.name}
                  username={targetUser.username}
                  size={40}
                />
                <UserName
                  name={targetUser.name}
                  username={targetUser.username}
                  verified={targetUser.verified}
                />
              </div>
              <div className='flex shrink-0 gap-2'>
                <Button
                  className='bg-main-accent px-3 py-1.5 text-sm font-bold text-main-accent-contrast'
                  onClick={(): Promise<void> => toggleVerified(targetUser)}
                  loading={processing[targetUser.id]}
                  disabled={processing[targetUser.id]}
                >
                  {targetUser.verified ? 'إلغاء التحقق' : 'تحقق'}
                </Button>
                <Button
                  className='bg-accent-red px-3 py-1.5 text-sm font-bold text-white'
                  onClick={(): Promise<void> => deleteUser(targetUser)}
                  loading={processing[targetUser.id]}
                  disabled={processing[targetUser.id]}
                >
                  حذف
                </Button>
              </div>
            </div>
          ))
        )}
      </section>
    </MainContainer>
  );
}
