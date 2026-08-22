import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { query, where, orderBy, limit, documentId } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { useMergedCollection } from '@lib/dual';
import { collectionsFor } from '@lib/firebase/collections';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { UserCard } from '@components/user/user-card';
import { Loading } from '@components/ui/loading';
import { SEO } from '@components/common/seo';
import type { ReactElement, ReactNode } from 'react';

export default function Search(): JSX.Element {
  const { push, query: routerQuery } = useRouter();
  const { user } = useAuth();
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

  const makeUsersQuery = (project: 'a' | 'b') => {
    if (!userId) return null;
    const cols = collectionsFor(project);

    if (!trimmedQuery)
      return query(
        cols.users,
        where(documentId(), '!=', userId),
        orderBy(documentId()),
        limit(20)
      );

    const end = `${trimmedQuery}\uf8ff`;

    return query(
      cols.users,
      where('username', '>=', trimmedQuery),
      where('username', '<=', end),
      orderBy('username'),
      limit(20)
    );
  };

  const usersQueryA = useMemo(
    () => makeUsersQuery('a'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, trimmedQuery]
  );
  const usersQueryB = useMemo(
    () => makeUsersQuery('b'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, trimmedQuery]
  );

  const fallbackSearch = trimmedQuery
    ? {
        collection: 'users' as const,
        where: {
          field: 'username',
          op: '>=' as const,
          value: trimmedQuery
        },
        orderBy: { field: 'username', dir: 'asc' as const },
        limit: 20
      }
    : undefined;
  const { data, loading } = useMergedCollection(usersQueryA, usersQueryB, {
    allowNull: true,
    fallback: fallbackSearch
      ? { a: fallbackSearch, b: fallbackSearch }
      : undefined
  });

  const results = data ?? [];
  const isSearching = trimmedQuery.length > 0;

  return (
    <MainContainer>
      <SEO
        title={isSearching ? `بحث: ${trimmedQuery} / Aite` : 'الأشخاص / Aite'}
      />
      <MainHeader title='الأشخاص' />
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
            placeholder='البحث عن مستخدم...'
            value={inputValue}
            onChange={({ target: { value } }): void => setInputValue(value)}
          />
        </label>
      </form>
      <section className='mt-0.5'>
        {loading ? (
          <Loading className='mt-5' />
        ) : results.length ? (
          results.map((userData) => (
            <UserCard {...userData} follow key={userData.id} />
          ))
        ) : (
          <div className='p-8 text-center'>
            <p className='text-2xl font-bold'>
              {isSearching ? 'لا توجد نتائج' : 'لا يوجد مستخدمون'}
            </p>
            <p className='mt-2 text-light-secondary dark:text-dark-secondary'>
              {isSearching
                ? 'جرب كلمة بحث أخرى.'
                : 'ستظهر اقتراحات المستخدمين هنا.'}
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
