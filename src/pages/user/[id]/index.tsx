import { doc, query, where, orderBy } from 'firebase/firestore';
import { AnimatePresence } from 'framer-motion';
import { useUser } from '@lib/context/user-context';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
import { tweetsCollection } from '@lib/firebase/collections';
import { mergeData } from '@lib/merge';
import { UserLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { UserDataLayout } from '@components/layout/user-data-layout';
import { UserHomeLayout } from '@components/layout/user-home-layout';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Loading } from '@components/ui/loading';
import { Tweet } from '@components/tweet/tweet';
import type { ReactElement, ReactNode } from 'react';

export default function UserTweets(): JSX.Element {
  const { user } = useUser();

  const { id, username, pinnedTweet } = user ?? {};

  const pinnedRef = pinnedTweet
    ? doc(tweetsCollection, pinnedTweet)
    : null;

  const { data: pinnedData } = useDocument(pinnedRef, {
    disabled: !pinnedTweet,
    allowNull: true,
    includeUser: true
  });

  const ownerTweetsQuery = id
    ? query(
        tweetsCollection,
        where('createdBy', '==', id),
        orderBy('createdAt', 'desc')
      )
    : null;

  const { data: ownerTweets, loading: ownerLoading } = useCollection(
    ownerTweetsQuery,
    { includeUser: true, allowNull: true, disabled: !id }
  );

  const peopleTweetsQuery = id
    ? query(tweetsCollection, where('userRetweets', 'array-contains', id))
    : null;

  const { data: peopleTweets, loading: peopleLoading } = useCollection(
    peopleTweetsQuery,
    { includeUser: true, allowNull: true, disabled: !id }
  );

  const ownerOnlyTweets = ownerTweets?.filter((tweet) => !tweet.parent) ?? null;

  const filteredPeopleTweets =
    peopleTweets?.filter((tweet) => tweet.createdBy !== id) ?? null;

  const mergedTweets = mergeData(true, ownerOnlyTweets, filteredPeopleTweets);

  return (
    <section>
      {ownerLoading || peopleLoading ? (
        <Loading className='mt-5' />
      ) : !mergedTweets ? (
        <StatsEmpty
          title={`@${username as string} لم ينشر`}
          description='عندما ينشر، ستظهر منشوراته هنا.'
        />
      ) : (
        <AnimatePresence mode='popLayout'>
          {pinnedData && (
            <Tweet pinned {...pinnedData} key={`pinned-${pinnedData.id}`} />
          )}
          {mergedTweets.map((tweet) => (
            <Tweet {...tweet} profile={user} key={tweet.id} />
          ))}
        </AnimatePresence>
      )}
    </section>
  );
}

UserTweets.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <UserLayout>
        <UserDataLayout>
          <UserHomeLayout>{page}</UserHomeLayout>
        </UserDataLayout>
      </UserLayout>
    </MainLayout>
  </ProtectedLayout>
);
