import { useMemo, useEffect } from 'react';
import { useDocument } from '@lib/hooks/useDocument';
import { useAnywhereRef } from '@lib/dual';
import { getRandomId } from '@lib/random';
import { Tweet } from './tweet';
import type { Tweet as TweetType } from '@lib/types/tweet';
import type { LoadedParents } from './tweet-with-parent';

type TweetParentProps = {
  parentId: string;
  loadedParents: LoadedParents;
  addParentId: (parentId: string, componentId: string) => void;
};

export function TweetParent({
  parentId,
  loadedParents,
  addParentId
}: TweetParentProps): JSX.Element | null {
  const componentId = useMemo(getRandomId, []);

  const isParentAlreadyLoaded = loadedParents.some(
    (child) => child.childId === componentId
  );

  const { ref: parentRef } = useAnywhereRef<TweetType>('tweets', parentId);
  const { data, loading } = useDocument(parentRef, {
    includeUser: true,
    allowNull: true,
    disabled: isParentAlreadyLoaded
  });

  useEffect(() => {
    addParentId(parentId, componentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !isParentAlreadyLoaded || !data) return null;

  return <Tweet parentTweet {...data} />;
}
