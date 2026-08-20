import { useState, type FormEvent, type ChangeEvent } from 'react';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { Button } from '@components/ui/button';
import { Loading } from '@components/ui/loading';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import type { User } from '@lib/types/user';

export default function Admin(): JSX.Element {
  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const fetchUsers = async (pwd: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${pwd}` }
      });

      const data = (await res.json()) as { users?: User[]; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'كلمة المرور خاطئة');
      }

      setUsers(data.users ?? []);
      setVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    void fetchUsers(password);
  };

  const toggleVerified = async (targetUser: User): Promise<void> => {
    setProcessing((prev) => ({ ...prev, [targetUser.id]: true }));

    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`
        },
        body: JSON.stringify({
          userId: targetUser.id,
          verified: !targetUser.verified
        })
      });

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
    if (!confirm(`حذف حساب ${targetUser.name} نهائيًا؟`)) return;

    setProcessing((prev) => ({ ...prev, [targetUser.id]: true }));

    try {
      await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`
        },
        body: JSON.stringify({ userId: targetUser.id })
      });

      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setProcessing((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  return (
    <MainContainer>
      <SEO title='لوحة التحكم / Aite' />
      <MainHeader title='لوحة التحكم' />
      {!verified ? (
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-8'>
          <p className='text-light-secondary dark:text-dark-secondary'>
            أدخل كلمة مرور لوحة التحكم
          </p>
          <input
            type='password'
            placeholder='كلمة المرور'
            value={password}
            onChange={({ target: { value } }: ChangeEvent<HTMLInputElement>) =>
              setPassword(value)
            }
            className='w-full rounded-xl border-2 border-light-border bg-transparent px-4 py-2 
                       outline-none transition focus:border-main-accent dark:border-dark-border'
          />
          {error && <p className='text-sm text-accent-red'>{error}</p>}
          <Button
            type='submit'
            className='bg-main-accent px-4 py-2 font-bold text-black'
            loading={loading}
            disabled={!password || loading}
          >
            دخول
          </Button>
        </form>
      ) : (
        <section className='flex flex-col'>
          {loading ? (
            <Loading className='mt-5' />
          ) : users.length === 0 ? (
            <p className='p-8 text-center text-light-secondary dark:text-dark-secondary'>
              لا يوجد مستخدمون
            </p>
          ) : (
            users.map((targetUser) => (
              <div
                key={targetUser.id}
                className='hover-animation flex items-center justify-between gap-3 border-b border-light-border
                           px-4 py-3 hover:bg-light-primary/5 dark:border-dark-border 
                           dark:hover:bg-dark-primary/5'
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
                    className='bg-main-accent px-3 py-1.5 text-sm font-bold text-black'
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
      )}
    </MainContainer>
  );
}
