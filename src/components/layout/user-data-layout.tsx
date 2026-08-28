import { useRouter } from 'next/router';
import { doc, query, where, limit } from 'firebase/firestore';
import { UserContextProvider } from '@lib/context/user-context';
import { useLanguage } from '@lib/context/language-context';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
import { usersCollection } from '@lib/firebase/collections';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { UserHeader } from '@components/user/user-header';
import type { LayoutProps } from './common-layout';

export function UserDataLayout({ children }: LayoutProps): JSX.Element {
  const { t } = useLanguage();
  const {
    query: { id },
    back
  } = useRouter();

  const username = Array.isArray(id) ? id[0] : id;

  const userQuery = username
    ? query(usersCollection, where('username', '==', username), limit(1))
    : null;

  const { data, loading: collectionLoading } = useCollection(userQuery, {
    allowNull: true,
    disabled: !username
  });

  const found = data?.[0] ?? null;
  const tryDocId = typeof username === 'string' && !collectionLoading && !found;
  const docId = tryDocId ? username : null;
  const { data: byId, loading: idLoading } = useDocument(
    docId ? doc(usersCollection, docId) : null,
    {
      allowNull: true,
      disabled: !tryDocId
    }
  );

  const user = found ?? byId ?? null;
  const loading = !username || collectionLoading || (tryDocId && idLoading);

  return (
    <UserContextProvider value={{ user, loading }}>
      {!user && !loading && <SEO title={t('profile.missing')} />}
      <MainContainer>
        <MainHeader useActionButton iconName='ArrowRightIcon' action={back}>
          <UserHeader />
        </MainHeader>
        {children}
      </MainContainer>
    </UserContextProvider>
  );
}
