import { useEffect } from 'react';
import { useDocument } from '@lib/hooks/useDocument';
import { useAnywhereRef } from '@lib/dual';
import { Tweet } from '@components/tweet/tweet';
import type { Tweet as TweetType } from '@lib/types/tweet';
import type { RefObject } from 'react';

type ViewParentTweetProps = {
  parentId: string;
  viewTweetRef: RefObject<HTMLElement>;
};

export function ViewParentTweet({
  parentId,
  viewTweetRef
}: ViewParentTweetProps): JSX.Element | null {
  const { ref: parentRef } = useAnywhereRef<TweetType>('tweets', parentId);
  const { data, loading } = useDocument(parentRef, {
    includeUser: true,
    allowNull: true
  });

  useEffect(() => {
    if (!loading) viewTweetRef.current?.scrollIntoView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, loading]);

  if (loading) return null;
  if (!data)
    return (
      <div className='px-4 pb-2 pt-3'>
        <p
          className='rounded-2xl bg-main-sidebar-background px-1 py-3 pl-4 
                     text-light-secondary dark:text-dark-secondary'
        >
          تم حذف هذا المنشور من قبل صاحبه.
        </p>
      </div>
    );

  return <Tweet parentTweet {...data} />;
}
