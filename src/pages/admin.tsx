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
import type { User } from '@lib/types/user';

export default function Admin(): JSX.Element {
  const { loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const adminFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('سجّل الدخول بحساب إداري أولاً.');
    return fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers }
    });
  };

  const fetchUsers = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminFetch('/api/admin/users');
      const data = (await response.json()) as { users?: User[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'لا تملك صلاحية الإدارة.');
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) void fetchUsers();
    // Reload only after the auth state has settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const toggleVerified = async (targetUser: User): Promise<void> => {
    setProcessing((prev) => ({ ...prev, [targetUser.id]: true }));
    try {
      const response = await adminFetch('/api/admin/users', {
        method: 'PATCH', body: JSON.stringify({ userId: targetUser.id, verified: !targetUser.verified })
      });
      if (!response.ok) throw new Error('تعذر تحديث حالة التحقق.');
      setUsers((prev) => prev.map((u) => u.id === targetUser.id ? { ...u, verified: !u.verified } : u));
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
      const response = await adminFetch('/api/admin/users', {
        method: 'DELETE', body: JSON.stringify({ userId: targetUser.id })
      });
      if (!response.ok) throw new Error('تعذر حذف المستخدم.');
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
      <section className='flex flex-col'>
        <div className='border-b border-light-border px-5 py-4 dark:border-dark-border'>
          <p className='font-bold'>إدارة المستخدمين</p>
          <p className='mt-1 text-sm text-light-secondary dark:text-dark-secondary'>
            تتطلب هذه الصفحة Firebase Custom Claim باسم <code>admin: true</code>.</p>
        </div>
        {loading ? <Loading className='mt-5' /> : error ? (
          <div className='m-5 rounded-2xl border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red'>
            <p>{error}</p><Button className='mt-3 bg-main-accent px-4 py-2 font-bold text-black' onClick={(): Promise<void> => fetchUsers()}>إعادة المحاولة</Button>
          </div>
        ) : users.length === 0 ? (
          <p className='p-8 text-center text-light-secondary dark:text-dark-secondary'>لا يوجد مستخدمون</p>
        ) : users.map((targetUser) => (
          <div key={targetUser.id} className='hover-animation flex items-center justify-between gap-3 border-b border-light-border px-4 py-3 hover:bg-light-primary/5 dark:border-dark-border dark:hover:bg-dark-primary/5'>
            <div className='flex items-center gap-3 overflow-hidden'>
              <UserAvatar src={targetUser.photoURL} alt={targetUser.name} username={targetUser.username} size={40} />
              <UserName name={targetUser.name} username={targetUser.username} verified={targetUser.verified} />
            </div>
            <div className='flex shrink-0 gap-2'>
              <Button className='bg-main-accent px-3 py-1.5 text-sm font-bold text-black' onClick={(): Promise<void> => toggleVerified(targetUser)} loading={processing[targetUser.id]} disabled={processing[targetUser.id]}>{targetUser.verified ? 'إلغاء التحقق' : 'تحقق'}</Button>
              <Button className='bg-accent-red px-3 py-1.5 text-sm font-bold text-white' onClick={(): Promise<void> => deleteUser(targetUser)} loading={processing[targetUser.id]} disabled={processing[targetUser.id]}>حذف</Button>
            </div>
          </div>
        ))}
      </section>
    </MainContainer>
  );
}
