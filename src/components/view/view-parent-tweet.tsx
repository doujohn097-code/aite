import { useEffect } from 'react';
import { useLanguage } from '@lib/context/language-context';
import { doc } from 'firebase/firestore';
import { useDocument } from '@lib/hooks/useDocument';
import { tweetsCollection } from '@lib/firebase/collections';
import { Tweet } from '@components/tweet/tweet';
import type { RefObject } from 'react';

type ViewParentTweetProps = {
  parentId: string;
  viewTweetRef: RefObject<HTMLElement>;
};

export function ViewParentTweet({
  parentId,
  viewTweetRef
}: ViewParentTweetProps): JSX.Element | null {
  const { t } = useLanguage();
  const { data, loading } = useDocument(doc(tweetsCollection, parentId), {
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
          {t('tweet.deletedByOwner')}
        </p>
      </div>
    );

  return <Tweet parentTweet {...data} />;
}
