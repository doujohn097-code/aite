import Link from 'next/link';
import { motion } from 'framer-motion';
import { limit, query, where, orderBy, documentId } from 'firebase/firestore';
import { useAuth } from '@lib/context/auth-context';
import { useMergedCollection } from '@lib/dual';
import { collectionsFor } from '@lib/firebase/collections';
import { UserCard } from '@components/user/user-card';
import { Loading } from '@components/ui/loading';
import { Error } from '@components/ui/error';
import { variants } from './aside-trends';

export function Suggestions(): JSX.Element {
  const { randomSeed } = useAuth();

  const { data: suggestionsData, loading: suggestionsLoading } =
    useMergedCollection(
      query(
        collectionsFor('a').users,
        where(documentId(), '>=', randomSeed),
        orderBy(documentId()),
        limit(3)
      ),
      query(
        collectionsFor('b').users,
        where(documentId(), '>=', randomSeed),
        orderBy(documentId()),
        limit(3)
      ),
      { allowNull: true }
    );

  return (
    <section className='hover-animation rounded-2xl bg-main-sidebar-background'>
      {suggestionsLoading ? (
        <Loading className='flex h-52 items-center justify-center p-4' />
      ) : suggestionsData ? (
        <motion.div className='inner:px-4 inner:py-3' {...variants}>
          <h2 className='text-xl font-bold'>اقتراحات المتابعة</h2>
          {suggestionsData?.map((userData) => (
            <UserCard {...userData} key={userData.id} />
          ))}
          <Link href='/search'>
            <a
              className='custom-button accent-tab hover-card block w-full rounded-2xl
                         rounded-t-none text-center text-main-accent'
            >
              عرض المزيد
            </a>
          </Link>
        </motion.div>
      ) : (
        <Error />
      )}
    </section>
  );
}
