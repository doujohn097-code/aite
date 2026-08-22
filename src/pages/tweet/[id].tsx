import { useRef } from 'react';
import { useRouter } from 'next/router';
import { doc } from 'firebase/firestore';
import { tweetsCollection } from '@lib/firebase/collections';
import { useDocument } from '@lib/hooks/useDocument';

import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { PostComments } from '@components/tweet/post-comments';
import { ViewTweet } from '@components/view/view-tweet';
import { SEO } from '@components/common/seo';
import { Loading } from '@components/ui/loading';
import { Error } from '@components/ui/error';
import { ViewParentTweet } from '@components/view/view-parent-tweet';
import type { ReactElement, ReactNode } from 'react';

export default function TweetId(): JSX.Element {
  const {
    query: { id },
    back
  } = useRouter();

  const tweetId = Array.isArray(id) ? id[0] : id;

  const tweetRef = tweetId ? doc(tweetsCollection, tweetId) : null;

  const { data: tweetData, loading: tweetLoading } = useDocument(tweetRef, {
    includeUser: true,
    allowNull: true,
    disabled: !tweetId
  });

  const viewTweetRef = useRef<HTMLElement>(null);

  const { text, images } = tweetData ?? {};

  const imagesLength = images?.length ?? 0;
  const parentId = tweetData?.parent?.id;

  const pageTitle = tweetData
    ? `${tweetData.user.name} على Aite: "${text ?? ''}${
        images ? ` (${imagesLength} ${imagesLength > 1 ? 'صور' : 'صورة'})` : ''
      }" / Aite`
    : null;

  return (
    <MainContainer>
      <MainHeader
        useActionButton
        iconName='ArrowRightIcon'
        title={parentId ? 'سلسلة' : 'منشور'}
        action={back}
      />
      <section>
        {tweetLoading ? (
          <Loading className='mt-5' />
        ) : !tweetData ? (
          <>
            <SEO title='المنشور غير موجود / Aite' />
            <Error message='المنشور غير موجود' />
          </>
        ) : (
          <>
            {pageTitle && <SEO title={pageTitle} />}
            {parentId && (
              <ViewParentTweet
                parentId={parentId}
                viewTweetRef={viewTweetRef}
              />
            )}
            <ViewTweet viewTweetRef={viewTweetRef} {...tweetData} />
            <PostComments
              tweetId={tweetData.id}
              ownerId={tweetData.createdBy}
            />
          </>
        )}
      </section>
    </MainContainer>
  );
}

TweetId.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);
