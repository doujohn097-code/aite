import { useRouter } from 'next/router';
import { query, where, limit } from 'firebase/firestore';
import { UserContextProvider } from '@lib/context/user-context';
import { useCollection } from '@lib/hooks/useCollection';
import { usersCollection } from '@lib/firebase/collections';
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

  const userQuery = username
    ? query(
        usersCollection,
        where('username', '==', username),
        limit(1)
      )
    : null;

  const { data, loading: collectionLoading } = useCollection(userQuery, {
    allowNull: true,
    disabled: !username
  });

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
