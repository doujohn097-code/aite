import { AnimatePresence } from 'framer-motion';
import { where, orderBy } from 'firebase/firestore';
import { useWindow } from '@lib/context/window-context';
import { useInfiniteScrollBoth } from '@lib/hooks/useInfiniteScroll';
import { collectionsFor } from '@lib/firebase/collections';
import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { Input } from '@components/input/input';
import { NotificationsButton } from '@components/home/notifications-button';
import { MainHeader } from '@components/home/main-header';
import { StoriesBar } from '@components/stories/stories-bar';
import { Tweet } from '@components/tweet/tweet';
import { Loading } from '@components/ui/loading';
import { Error } from '@components/ui/error';
import type { ReactElement, ReactNode } from 'react';

export default function Home(): JSX.Element {
  const { isMobile } = useWindow();

  const { data, loading, LoadMore } = useInfiniteScrollBoth(
    collectionsFor('a').tweets,
    collectionsFor('b').tweets,
    [where('parent', '==', null), orderBy('createdAt', 'desc')],
    { includeUser: true, allowNull: true, preserve: true }
  );

  return (
    <MainContainer>
      <SEO title='الرئيسية / Aite' />
      <MainHeader
        useMobileSidebar
        logo='/assets/home-logo.png'
        className='flex items-center justify-between'
      >
        <NotificationsButton />
      </MainHeader>
      {/* Stories bar - force rebuild */}
      <StoriesBar />
      {!isMobile && <Input />}
      <section className='mt-0.5 xs:mt-0'>
        {loading ? (
          <Loading className='mt-5' />
        ) : !data ? (
          <Error message='حدث خطأ ما. حاول إعادة التحميل.' />
        ) : (
          <>
            <AnimatePresence mode='popLayout'>
              {data.map((tweet) => (
                <Tweet {...tweet} key={tweet.id} />
              ))}
            </AnimatePresence>
            <LoadMore />
          </>
        )}
      </section>
    </MainContainer>
  );
}

Home.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);
