import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@lib/firebase/app';
import { writeImpersonation } from '@lib/impersonation';
import { useAuth } from '@lib/context/auth-context';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '@lib/app-version';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { Button } from '@components/ui/button';
import { Loading } from '@components/ui/loading';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { InputField } from '@components/input/input-field';
import { HeroIcon } from '@components/ui/hero-icon';
import { LinkifiedText } from '@components/ui/linkified-text';
import cn from 'clsx';
import type { ChangeEvent, FormEvent } from 'react';
import type { User } from '@lib/types/user';

type Tab = 'users' | 'posts' | 'comments' | 'reels' | 'updates';

type Author = {
  id: string;
  name: string;
  username: string;
  photoURL: string | null;
  verified: boolean;
};

type ContentMedia = { src: string; thumbnail: string | null; type: string };

type ContentItem = {
  id: string;
  text?: string | null;
  caption?: string | null;
  createdBy?: string | null;
  userId?: string | null;
  kind?: string | null;
  parentId?: string | null;
  parentUsername?: string | null;
  createdAt?: number | null;
  media?: ContentMedia[];
  likes?: number;
  replies?: number;
  views?: number;
  author?: Author | null;
};

function formatAdminTime(ms?: number | null): string {
  if (!ms) return 'بدون تاريخ';
  return new Intl.DateTimeFormat('ar', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ms));
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'users', label: 'المستخدمون', icon: 'UsersIcon' },
  { id: 'posts', label: 'المنشورات', icon: 'ChatBubbleBottomCenterTextIcon' },
  { id: 'comments', label: 'التعليقات', icon: 'ChatBubbleOvalLeftIcon' },
  { id: 'reels', label: 'الريلز', icon: 'FilmIcon' },
  { id: 'updates', label: 'التحديث', icon: 'ArrowDownTrayIcon' }
];

export default function Admin(): JSX.Element {
  const router = useRouter();
  const { loading: authLoading } = useAuth();

  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('users');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [updateForm, setUpdateForm] = useState({
    versionName: '',
    versionCode: '',
    title: 'تحديث جديد',
    message: '',
    apkUrl: '',
    force: false,
    target: 'all'
  });
  const [currentUpdate, setCurrentUpdate] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [publishing, setPublishing] = useState(false);

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

  const loadTab = async (nextTab = tab, key = adminKey): Promise<void> => {
    if (!key) return;
    setLoading(true);
    setError(null);
    try {
      if (nextTab === 'users') {
        const response = await adminFetch('/api/admin/users', {}, key);
        const data = (await response.json()) as {
          users?: User[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error ?? 'لا تملك صلاحية الإدارة.');
        setUsers(data.users ?? []);
      } else if (nextTab === 'updates') {
        const response = await adminFetch('/api/admin/update', {}, key);
        const data = (await response.json()) as {
          update?: Record<string, unknown> | null;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? 'تعذر جلب التحديث');
        setCurrentUpdate(data.update ?? null);
      } else {
        const params = new URLSearchParams({
          kind: nextTab,
          ...(query.trim() ? { q: query.trim() } : {})
        });
        const response = await adminFetch(
          `/api/admin/content?${params.toString()}`,
          {},
          key
        );
        const data = (await response.json()) as {
          items?: ContentItem[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? 'تعذر جلب المحتوى');
        setItems(data.items ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && adminKey) void loadTab(tab, adminKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, adminKey, tab]);

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
      setAdminKey(password);
      setPassword('');
    } catch (err) {
      setLockError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setUnlocking(false);
    }
  };

  const lock = (): void => {
    setAdminKey(null);
    setUsers([]);
    setItems([]);
    setPasswordUser(null);
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
        prev.map((user) =>
          user.id === targetUser.id
            ? { ...user, verified: !user.verified }
            : user
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setProcessing((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const enterAccount = async (targetUser: User): Promise<void> => {
    const confirmed = confirm(
      `الدخول إلى حساب ${targetUser.name} (@${targetUser.username})؟\n\nستُفتح جلسته كما يراها هو. يمكنك إنهاؤها من الشريط الأصفر.`
    );
    if (!confirmed) return;
    setProcessing((prev) => ({ ...prev, [targetUser.id]: true }));
    setError(null);
    try {
      const response = await adminFetch('/api/admin/impersonate', {
        method: 'POST',
        body: JSON.stringify({ userId: targetUser.id })
      });
      const data = (await response.json().catch(() => null)) as {
        token?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.token)
        throw new Error(data?.error ?? 'تعذر فتح الحساب');
      writeImpersonation({
        userId: targetUser.id,
        username: targetUser.username,
        name: targetUser.name
      });
      await signInWithCustomToken(auth, data.token);
      void router.replace(
        targetUser.username ? `/user/${targetUser.username}` : '/home'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فتح الحساب');
    } finally {
      setProcessing((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const deleteUser = async (targetUser: User): Promise<void> => {
    const confirmed = confirm(
      `حذف حساب ${targetUser.name} نهائيًا؟\n\nسيتم حذف المنشورات والتعليقات والريلز والمحادثات والإشعارات. لا يمكن التراجع.`
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
      setUsers((prev) => prev.filter((user) => user.id !== targetUser.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setProcessing((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const changePassword = async (): Promise<void> => {
    if (!passwordUser) return;
    setProcessing((prev) => ({ ...prev, [passwordUser.id]: true }));
    try {
      const response = await adminFetch('/api/admin/password', {
        method: 'PATCH',
        body: JSON.stringify({
          userId: passwordUser.id,
          password: newPassword
        })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? 'تعذر تغيير كلمة المرور');
      setPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setProcessing((prev) => ({ ...prev, [passwordUser.id]: false }));
    }
  };

  const publishUpdate = async (): Promise<void> => {
    setPublishing(true);
    setError(null);
    try {
      const response = await adminFetch('/api/admin/update', {
        method: 'POST',
        body: JSON.stringify({
          versionName: updateForm.versionName,
          versionCode: Number(updateForm.versionCode),
          title: updateForm.title,
          message: updateForm.message,
          apkUrl: updateForm.apkUrl.trim() || null,
          force: updateForm.force,
          target: updateForm.target
        })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        update?: Record<string, unknown>;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? 'تعذر إطلاق التحديث');
      setCurrentUpdate(data?.update ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setPublishing(false);
    }
  };

  const stopUpdate = async (): Promise<void> => {
    setPublishing(true);
    try {
      const response = await adminFetch('/api/admin/update', {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('تعذر إيقاف التحديث');
      setCurrentUpdate((prev) => (prev ? { ...prev, active: false } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setPublishing(false);
    }
  };

  const deleteContent = async (item: ContentItem): Promise<void> => {
    const label =
      tab === 'reels' ? 'الريل' : tab === 'comments' ? 'التعليق' : 'المنشور';
    const extra =
      tab === 'posts'
        ? 'ستُحذف تعليقاته وردوده أيضاً.'
        : tab === 'comments'
        ? 'ستُحذف الردود التابعة له أيضاً.'
        : 'ستُحذف تعليقات الريل أيضاً.';
    if (!confirm(`حذف ${label} نهائياً؟\n${extra}`)) return;
    setProcessing((prev) => ({ ...prev, [item.id]: true }));
    try {
      const response = await adminFetch('/api/admin/content', {
        method: 'DELETE',
        body: JSON.stringify({ kind: tab, id: item.id })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? 'تعذر حذف العنصر');
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setProcessing((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(needle) ||
        user.username.toLowerCase().includes(needle)
    );
  }, [query, users]);

  if (!adminKey)
    return (
      <MainContainer>
        <SEO title='لوحة التحكم / Aite' />
        <MainHeader title='لوحة التحكم' />
        <section className='flex flex-col items-center gap-5 px-5 py-10'>
          <span className='flex h-16 w-16 items-center justify-center rounded-2xl bg-main-accent/15 text-main-accent-text'>
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
            onSubmit={(event): void => void handleUnlock(event)}
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
              className='bg-main-accent py-2.5 font-bold text-main-accent-contrast transition hover:brightness-90 active:brightness-75'
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
            <p className='font-bold'>إدارة المنصة</p>
            <p className='mt-1 text-sm text-light-secondary dark:text-dark-secondary'>
              حذف المنشور يحذف تعليقاته، وحذف التعليق يحذف ردوده، وحذف الريل
              يحذف تعليقاته.
            </p>
          </div>
          <Button
            className='shrink-0 rounded-full border border-light-border px-3 py-1.5 text-xs font-bold transition hover:bg-light-primary/10 dark:border-dark-border dark:hover:bg-dark-primary/10'
            onClick={lock}
          >
            قفل
          </Button>
        </div>

        <div className='flex gap-2 overflow-x-auto border-b border-light-border px-4 py-3 dark:border-dark-border'>
          {TABS.map((item) => (
            <button
              key={item.id}
              type='button'
              onClick={(): void => setTab(item.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition',
                tab === item.id
                  ? 'bg-main-accent text-main-accent-contrast'
                  : 'bg-light-primary/5 text-light-secondary hover:bg-light-primary/10 dark:text-dark-secondary'
              )}
            >
              <HeroIcon className='h-4 w-4' iconName={item.icon} />
              {item.label}
            </button>
          ))}
        </div>

        {tab !== 'updates' && (
          <form
            className='flex gap-2 border-b border-light-border px-4 py-3 dark:border-dark-border'
            onSubmit={(event): void => {
              event.preventDefault();
              void loadTab();
            }}
          >
            <input
              value={query}
              onChange={(event): void => setQuery(event.target.value)}
              placeholder={
                tab === 'users'
                  ? 'ابحث بالاسم أو المعرف...'
                  : 'ابحث بالنص أو اسم الناشر...'
              }
              className='min-w-0 flex-1 rounded-full bg-light-line-reply/40 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-main-accent dark:bg-dark-line-reply/40'
            />
            <Button
              type='submit'
              className='rounded-full bg-main-accent px-4 py-2 text-sm font-bold text-main-accent-contrast'
            >
              بحث
            </Button>
          </form>
        )}

        {error && (
          <div className='m-4 rounded-2xl border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red'>
            {error}
          </div>
        )}

        {loading ? (
          <Loading className='mt-5' />
        ) : tab === 'updates' ? (
          <div className='flex flex-col gap-4 px-4 py-5'>
            {currentUpdate?.active ? (
              <div className='rounded-2xl border border-main-accent/30 bg-main-accent/10 p-4 text-sm'>
                <p className='font-bold text-main-accent-text'>
                  تحديث نشط الآن
                </p>
                <p className='mt-1'>
                  {String(currentUpdate.title ?? 'تحديث')} ·{' '}
                  {String(currentUpdate.versionName ?? '')} (
                  {String(currentUpdate.versionCode ?? '')})
                </p>
                <Button
                  className='mt-3 rounded-full bg-accent-red px-4 py-2 text-sm font-bold text-white'
                  loading={publishing}
                  onClick={(): Promise<void> => stopUpdate()}
                >
                  إيقاف الإعلان
                </Button>
              </div>
            ) : (
              <p className='text-sm text-light-secondary dark:text-dark-secondary'>
                لا يوجد تحديث ظاهر للمستخدمين حالياً.
              </p>
            )}
            <p className='text-sm leading-relaxed text-light-secondary dark:text-dark-secondary'>
              يظهر الإعلان فقط لمن نسخته أقدم من رمز الإصدار الذي تدخله. النسخة
              الحالية للمنصة {APP_VERSION_NAME} (رمز {APP_VERSION_CODE}) —
              استخدم رقماً أكبر. أثناء التنزيل تختفي «لاحقاً» ويظهر شريط التقدم
              حتى لا يخرج المستخدم.
            </p>
            <input
              value={updateForm.versionName}
              onChange={(event): void =>
                setUpdateForm((prev) => ({
                  ...prev,
                  versionName: event.target.value
                }))
              }
              placeholder='اسم الإصدار مثل 1.3.0'
              className='rounded-2xl border border-light-border bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-main-accent dark:border-dark-border'
            />
            <input
              value={updateForm.versionCode}
              onChange={(event): void =>
                setUpdateForm((prev) => ({
                  ...prev,
                  versionCode: event.target.value
                }))
              }
              inputMode='numeric'
              placeholder='رمز الإصدار (أكبر من النسخة الحالية، مثل 6)'
              className='rounded-2xl border border-light-border bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-main-accent dark:border-dark-border'
            />
            <input
              value={updateForm.title}
              onChange={(event): void =>
                setUpdateForm((prev) => ({
                  ...prev,
                  title: event.target.value
                }))
              }
              placeholder='عنوان الإعلان'
              className='rounded-2xl border border-light-border bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-main-accent dark:border-dark-border'
            />
            <textarea
              value={updateForm.message}
              onChange={(event): void =>
                setUpdateForm((prev) => ({
                  ...prev,
                  message: event.target.value
                }))
              }
              placeholder='ماذا يتضمن التحديث؟'
              rows={4}
              className='rounded-2xl border border-light-border bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-main-accent dark:border-dark-border'
            />
            <input
              value={updateForm.apkUrl}
              onChange={(event): void =>
                setUpdateForm((prev) => ({
                  ...prev,
                  apkUrl: event.target.value
                }))
              }
              placeholder='رابط APK المباشر (https://...apk)'
              className='rounded-2xl border border-light-border bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-main-accent dark:border-dark-border'
            />
            <select
              value={updateForm.target}
              onChange={(event): void =>
                setUpdateForm((prev) => ({
                  ...prev,
                  target: event.target.value
                }))
              }
              className='rounded-2xl border border-light-border bg-transparent px-4 py-2.5 outline-none dark:border-dark-border'
            >
              <option value='all'>الجميع (أندرويد + الموقع)</option>
              <option value='android'>تطبيق أندرويد فقط</option>
              <option value='web'>الموقع فقط</option>
            </select>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={updateForm.force}
                onChange={(event): void =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    force: event.target.checked
                  }))
                }
              />
              تحديث إجباري (لا يمكن إخفاؤه)
            </label>
            <Button
              className='rounded-full bg-main-accent py-3 font-bold text-main-accent-contrast'
              loading={publishing}
              disabled={
                !updateForm.versionName.trim() || !updateForm.versionCode.trim()
              }
              onClick={(): Promise<void> => publishUpdate()}
            >
              إطلاق التحديث للمستخدمين
            </Button>
          </div>
        ) : tab === 'users' ? (
          filteredUsers.length === 0 ? (
            <p className='p-8 text-center text-light-secondary dark:text-dark-secondary'>
              لا يوجد مستخدمون
            </p>
          ) : (
            <div className='flex flex-col'>
              <p className='px-5 py-2 text-xs font-bold text-light-secondary dark:text-dark-secondary'>
                {filteredUsers.length} حساب
              </p>
              {filteredUsers.map((targetUser) => (
                <div
                  key={targetUser.id}
                  className='hover-animation flex flex-col gap-3 border-b border-light-border px-4 py-4 dark:border-dark-border xs:flex-row xs:items-center xs:justify-between'
                >
                  <div className='flex min-w-0 items-center gap-3'>
                    <UserAvatar
                      src={targetUser.photoURL}
                      alt={targetUser.name}
                      username={targetUser.username}
                      size={44}
                    />
                    <div className='min-w-0'>
                      <UserName
                        name={targetUser.name}
                        username={targetUser.username}
                        verified={targetUser.verified}
                      />
                      <p className='mt-0.5 text-[11px] text-light-secondary dark:text-dark-secondary'>
                        {targetUser.following?.length ?? 0} يتابع ·{' '}
                        {targetUser.followers?.length ?? 0} متابع ·{' '}
                        {targetUser.totalTweets ?? 0} منشور
                      </p>
                    </div>
                  </div>
                  <div className='flex w-full flex-col gap-2 xs:w-auto'>
                    <Button
                      className='w-full bg-emerald-600 px-3 py-2 text-sm font-bold text-white xs:w-auto'
                      onClick={(): void => {
                        void enterAccount(targetUser);
                      }}
                      loading={processing[targetUser.id]}
                      disabled={processing[targetUser.id]}
                    >
                      دخول للحساب
                    </Button>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        className='bg-main-accent px-3 py-1.5 text-sm font-bold text-main-accent-contrast'
                        onClick={(): Promise<void> =>
                          toggleVerified(targetUser)
                        }
                        loading={processing[targetUser.id]}
                        disabled={processing[targetUser.id]}
                      >
                        {targetUser.verified ? 'نزع التحقق' : 'منح التحقق'}
                      </Button>
                      <Button
                        className='border border-light-border px-3 py-1.5 text-sm font-bold dark:border-dark-border'
                        onClick={(): void => {
                          setPasswordUser(targetUser);
                          setNewPassword('');
                        }}
                        disabled={processing[targetUser.id]}
                      >
                        كلمة المرور
                      </Button>
                      <Button
                        className='bg-accent-red px-3 py-1.5 text-sm font-bold text-white'
                        onClick={(): Promise<void> => deleteUser(targetUser)}
                        loading={processing[targetUser.id]}
                        disabled={processing[targetUser.id]}
                      >
                        حذف الحساب
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <p className='p-8 text-center text-light-secondary dark:text-dark-secondary'>
            لا توجد عناصر
          </p>
        ) : (
          <div className='flex flex-col'>
            <p className='px-5 py-2 text-xs font-bold text-light-secondary dark:text-dark-secondary'>
              {items.length}{' '}
              {tab === 'reels' ? 'ريل' : tab === 'comments' ? 'تعليق' : 'منشور'}
            </p>
            {items.map((item) => {
              const body = String(item.text ?? item.caption ?? '').trim();
              const author = item.author;
              const href =
                tab === 'reels'
                  ? `/reels?video=${item.id}`
                  : `/tweet/${item.parentId || item.id}`;
              const thumb = item.media?.[0];
              const thumbSrc = thumb?.thumbnail || thumb?.src || null;
              return (
                <article
                  key={item.id}
                  className='flex flex-col gap-3 border-b border-light-border px-4 py-4 dark:border-dark-border'
                >
                  <div className='flex items-start gap-3'>
                    {author ? (
                      <UserAvatar
                        src={author.photoURL}
                        alt={author.name}
                        username={author.username}
                        size={40}
                      />
                    ) : (
                      <span className='h-10 w-10 shrink-0 rounded-full bg-light-line-reply dark:bg-dark-line-reply' />
                    )}
                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                        {author ? (
                          <UserName
                            name={author.name || author.username}
                            username={author.username}
                            verified={author.verified}
                          />
                        ) : (
                          <p className='text-sm font-bold'>حساب محذوف</p>
                        )}
                        <span className='rounded-full bg-main-accent/10 px-2 py-0.5 text-[10px] font-bold text-main-accent-text'>
                          {tab === 'reels'
                            ? 'ريل'
                            : tab === 'comments'
                            ? 'تعليق'
                            : 'منشور'}
                        </span>
                        <span className='text-[11px] text-light-secondary dark:text-dark-secondary'>
                          {formatAdminTime(item.createdAt)}
                        </span>
                      </div>
                      {tab === 'comments' && item.parentId && (
                        <p className='mt-1 text-[11px] text-light-secondary dark:text-dark-secondary'>
                          رد على{' '}
                          {item.parentUsername
                            ? `@${item.parentUsername}`
                            : 'منشور'}
                        </p>
                      )}
                      <p className='mt-2 whitespace-pre-line break-words text-sm leading-relaxed'>
                        {body ? (
                          <LinkifiedText text={body} />
                        ) : (
                          <span className='text-light-secondary'>بدون نص</span>
                        )}
                      </p>
                      {thumbSrc && (
                        <div className='mt-3 overflow-hidden rounded-2xl border border-light-border dark:border-dark-border'>
                          {thumb?.type?.startsWith('video/') ? (
                            <video
                              src={thumb.src}
                              poster={thumb.thumbnail ?? undefined}
                              className='max-h-56 w-full bg-black object-contain'
                              controls
                              playsInline
                              preload='metadata'
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumbSrc}
                              alt=''
                              className='max-h-56 w-full object-cover'
                            />
                          )}
                        </div>
                      )}
                      <div className='mt-3 flex flex-wrap items-center gap-3 text-[11px] text-light-secondary dark:text-dark-secondary'>
                        <span>{item.likes ?? 0} إعجاب</span>
                        {tab !== 'reels' && <span>{item.replies ?? 0} رد</span>}
                        {tab === 'reels' && (
                          <span>{item.views ?? 0} مشاهدة</span>
                        )}
                        <a
                          href={href}
                          target='_blank'
                          rel='noreferrer'
                          className='font-bold text-main-accent-text hover:underline'
                        >
                          فتح
                        </a>
                      </div>
                    </div>
                    <Button
                      className='shrink-0 bg-accent-red px-3 py-1.5 text-sm font-bold text-white'
                      onClick={(): Promise<void> => deleteContent(item)}
                      loading={processing[item.id]}
                      disabled={processing[item.id]}
                    >
                      حذف
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {passwordUser && (
        <div className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 xs:items-center'>
          <div className='w-full max-w-sm rounded-3xl border border-light-border bg-main-background p-5 dark:border-dark-border'>
            <h3 className='text-lg font-bold'>تغيير كلمة مرور الحساب</h3>
            <p className='mt-1 text-sm text-light-secondary dark:text-dark-secondary'>
              {passwordUser.name} · @{passwordUser.username}
            </p>
            <input
              type='password'
              value={newPassword}
              onChange={(event): void => setNewPassword(event.target.value)}
              placeholder='كلمة مرور جديدة (6 أحرف على الأقل)'
              className='mt-4 w-full rounded-2xl border border-light-border bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-main-accent dark:border-dark-border'
            />
            <div className='mt-4 flex justify-end gap-2'>
              <Button
                className='px-3 py-2 text-sm'
                onClick={(): void => setPasswordUser(null)}
              >
                إلغاء
              </Button>
              <Button
                className='bg-main-accent px-4 py-2 text-sm font-bold text-main-accent-contrast'
                disabled={newPassword.length < 6}
                loading={processing[passwordUser.id]}
                onClick={(): Promise<void> => changePassword()}
              >
                حفظ
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainContainer>
  );
}
