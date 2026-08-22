import { useRouter } from 'next/router';
import { query, where, limit } from 'firebase/firestore';
import { UserContextProvider } from '@lib/context/user-context';
import { useMergedCollection } from '@lib/dual';
import { collectionsFor } from '@lib/firebase/collections';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { UserHeader } from '@components/user/user-header';
import type { LayoutProps } from './common-layout';

export function UserDataLayout({ children }: LayoutProps): JSX.Element {
  const {
    query: { id },
    back
  } = useRouter();

  const username = Array.isArray(id) ? id[0] : id;

  const userQueryA = username
    ? query(
        collectionsFor('a').users,
        where('username', '==', username),
        limit(1)
      )
    : null;
  const userQueryB = username
    ? query(
        collectionsFor('b').users,
        where('username', '==', username),
        limit(1)
      )
    : null;

  const { data, loading: collectionLoading } = useMergedCollection(
    userQueryA,
    userQueryB,
    {
      allowNull: true,
      disabled: !username,
      fallback: username
        ? {
            a: {
              collection: 'users',
              where: { field: 'username', op: '==', value: username },
              limit: 1
            },
            b: {
              collection: 'users',
              where: { field: 'username', op: '==', value: username },
              limit: 1
            }
          }
        : undefined
    }
  );

  const loading = collectionLoading || !username;
  const user = data ? data[0] : null;

  return (
    <UserContextProvider value={{ user, loading }}>
      {!user && !loading && <SEO title='المستخدم غير موجود / Aite' />}
      <MainContainer>
        <MainHeader useActionButton iconName='ArrowRightIcon' action={back}>
          <UserHeader />
        </MainHeader>
        {children}
      </MainContainer>
    </UserContextProvider>
  );
}
