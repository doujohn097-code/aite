import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { where, orderBy, documentId } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import { useInfiniteScroll } from '@lib/hooks/useInfiniteScroll';
import { usersCollection } from '@lib/firebase/collections';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { UserCard } from '@components/user/user-card';
import { UserFeedSkeleton } from '@components/ui/skeleton';
import { SEO } from '@components/common/seo';
import type { ReactElement, ReactNode } from 'react';

const USERS_PAGE_SIZE = 20;

export default function Search(): JSX.Element {
  const { push, query: routerQuery } = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.id;

  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const q = routerQuery.q;
    const rawQuery = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : '';
    setInputValue(rawQuery ?? '');
  }, [routerQuery.q]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed)
      void push(`/search?q=${encodeURIComponent(trimmed)}`, undefined, {
        shallow: true
      });
    else void push('/search', undefined, { shallow: true });
  };

  const trimmedQuery = inputValue.trim().toLowerCase();

  // شرطا الاستعلام حسب الوضع: تصفّح كل الأشخاص أو بحث ببادئة اسم المستخدم.
  // الترقيم (تحميل المزيد) يُدار بواسطة useInfiniteScroll فوق هذه الشروط.
  const constraints = useMemo(() => {
    if (!trimmedQuery)
      return [where(documentId(), '!=', userId ?? ''), orderBy(documentId())];

    const end = `${trimmedQuery}\uf8ff`;

    return [
      where('username', '>=', trimmedQuery),
      where('username', '<=', end),
      orderBy('username')
    ];
  }, [userId, trimmedQuery]);

  const { data, loading, LoadMore } = useInfiniteScroll(
    usersCollection,
    constraints,
    { allowNull: true, disabled: !userId },
    {
      initialSize: USERS_PAGE_SIZE,
      stepSize: USERS_PAGE_SIZE,
      // إعادة ضبط الترقيم عند تغيّر الوضع (تصفّح ↔ بحث) أو تغيّر الجلسة.
      resetKey: `${userId ?? ''}|${trimmedQuery}`
    }
  );

  const results = data ?? [];
  const isSearching = trimmedQuery.length > 0;

  return (
    <MainContainer>
      <SEO
        title={
          isSearching ? t('search.seo', { q: trimmedQuery }) : t('search.title')
        }
      />
      <MainHeader title={t('search.heading')} />
      <form
        onSubmit={handleSubmit}
        className='sticky top-0 z-10 -my-2 border-b border-light-border bg-main-background px-4 py-3 dark:border-dark-border'
      >
        <label
          className='group flex items-center gap-4 rounded-full bg-main-search-background px-4 py-2 
                     transition focus-within:bg-main-background focus-within:ring-2 focus-within:ring-main-accent'
        >
          <input
            className='flex-1 bg-transparent outline-none placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
            type='text'
            placeholder={t('search.placeholder')}
            value={inputValue}
            onChange={({ target: { value } }): void => setInputValue(value)}
          />
        </label>
      </form>
      <section className='mt-0.5'>
        {loading ? (
          <UserFeedSkeleton />
        ) : results.length ? (
          <>
            {results.map((userData) => (
              <UserCard {...userData} follow key={userData.id} />
            ))}
            <LoadMore />
          </>
        ) : (
          <div className='p-8 text-center'>
            <p className='text-2xl font-bold'>
              {isSearching ? t('search.none') : t('search.empty')}
            </p>
            <p className='mt-2 text-light-secondary dark:text-dark-secondary'>
              {isSearching ? t('search.noneHint') : t('search.emptyHint')}
            </p>
          </div>
        )}
      </section>
    </MainContainer>
  );
}

Search.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);
