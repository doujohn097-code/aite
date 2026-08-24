/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo } from 'react';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { manageRetweet, manageLike } from '@lib/firebase/utils';

import { TweetOption } from './tweet-option';
import { TweetShare } from './tweet-share';
import type { Tweet } from '@lib/types/tweet';
import type { SharedPostRef } from '@lib/types/message';
import { useLanguage } from '@lib/context/language-context';

type TweetStatsProps = Pick<
  Tweet,
  'userLikes' | 'userRetweets' | 'userReplies'
> & {
  reply?: boolean;
  userId: string;
  isOwner: boolean;
  tweetId: string;
  viewTweet?: boolean;
  openModal?: () => void;
  /** بطاقة مشاركة المنشور عبر الرسائل */
  shared?: SharedPostRef;
};

export function TweetStats({
  reply,
  userId,
  isOwner,
  tweetId,
  userLikes,
  viewTweet,
  userRetweets,
  userReplies: totalReplies,
  openModal,
  shared
}: TweetStatsProps): JSX.Element {
  const { t } = useLanguage();

  const totalLikes = userLikes?.length ?? 0;
  const totalTweets = userRetweets?.length ?? 0;

  const [{ currentReplies, currentTweets, currentLikes }, setCurrentStats] =
    useState({
      currentReplies: totalReplies,
      currentLikes: totalLikes,
      currentTweets: totalTweets
    });

  useEffect(() => {
    setCurrentStats({
      currentReplies: totalReplies,
      currentLikes: totalLikes,
      currentTweets: totalTweets
    });
  }, [totalReplies, totalLikes, totalTweets]);

  const replyMove = useMemo(
    () => (totalReplies > currentReplies ? -25 : 25),
    [totalReplies]
  );

  const likeMove = useMemo(
    () => (totalLikes > currentLikes ? -25 : 25),
    [totalLikes]
  );

  const tweetMove = useMemo(
    () => (totalTweets > currentTweets ? -25 : 25),
    [totalTweets]
  );

  const tweetIsLiked = userLikes?.includes(userId) ?? false;
  const tweetIsRetweeted = userRetweets?.includes(userId) ?? false;

  const [optimisticLike, setOptimisticLike] = useState<boolean | null>(null);
  const [optimisticRetweet, setOptimisticRetweet] = useState<boolean | null>(
    null
  );

  // Drop the override once the Firestore listener confirms the new state
  useEffect(() => {
    if (optimisticLike !== null && tweetIsLiked === optimisticLike)
      setOptimisticLike(null);
  }, [tweetIsLiked, optimisticLike]);

  useEffect(() => {
    if (optimisticRetweet !== null && tweetIsRetweeted === optimisticRetweet)
      setOptimisticRetweet(null);
  }, [tweetIsRetweeted, optimisticRetweet]);

  const liked = optimisticLike ?? tweetIsLiked;
  const retweeted = optimisticRetweet ?? tweetIsRetweeted;

  const likeDelta =
    optimisticLike === null
      ? 0
      : (optimisticLike ? 1 : 0) - (tweetIsLiked ? 1 : 0);
  const retweetDelta =
    optimisticRetweet === null
      ? 0
      : (optimisticRetweet ? 1 : 0) - (tweetIsRetweeted ? 1 : 0);

  const handleLike = (): void => {
    const next = !liked;
    setOptimisticLike(next);
    void manageLike(next ? 'like' : 'unlike', userId, tweetId)().catch(() => {
      setOptimisticLike(null);
      toast.error(t('err.tryAgain'));
    });
  };

  const handleRetweet = (): void => {
    const next = !retweeted;
    setOptimisticRetweet(next);
    void manageRetweet(next ? 'retweet' : 'unretweet', userId, tweetId)().catch(
      () => {
        setOptimisticRetweet(null);
        toast.error(t('err.tryAgain'));
      }
    );
  };

  const isStatsVisible = !!(totalReplies || totalTweets || totalLikes);

  return (
    <>
      <div
        className={cn(
          'grid w-full grid-cols-4 text-light-secondary dark:text-dark-secondary',
          viewTweet ? 'py-2' : 'py-1'
        )}
      >
        <TweetOption
          className={cn(
            'hover:text-red-600 focus-visible:text-red-600',
            liked && 'text-red-600'
          )}
          iconClassName='group-hover:bg-red-500/10 group-active:bg-red-500/20
                         group-focus-visible:bg-red-500/10 group-focus-visible:ring-red-500/80'
          tip={liked ? t('tweet.unlike') : t('action.like')}
          move={likeDelta ? (likeDelta > 0 ? -25 : 25) : likeMove}
          stats={currentLikes + likeDelta}
          iconName='HeartIcon'
          viewTweet={viewTweet}
          solid={liked}
          pop
          onClick={handleLike}
        />
        <TweetOption
          className='hover:text-accent-blue focus-visible:text-accent-blue'
          iconClassName='group-hover:bg-accent-blue/10 group-active:bg-accent-blue/20 
                         group-focus-visible:bg-accent-blue/10 group-focus-visible:ring-accent-blue/80'
          tip={t('tweet.comment')}
          move={replyMove}
          stats={currentReplies}
          iconName='ChatBubbleOvalLeftIcon'
          viewTweet={viewTweet}
          onClick={openModal}
          disabled={reply}
        />
        <TweetOption
          className={cn(
            'hover:text-accent-green focus-visible:text-accent-green',
            retweeted && 'text-accent-green'
          )}
          iconClassName='group-hover:bg-accent-green/10 group-active:bg-accent-green/20
                         group-focus-visible:bg-accent-green/10 group-focus-visible:ring-accent-green/80'
          tip={retweeted ? t('reels.unrepost') : t('reels.repost')}
          move={retweetDelta ? (retweetDelta > 0 ? -25 : 25) : tweetMove}
          stats={currentTweets + retweetDelta}
          iconName='ArrowPathRoundedSquareIcon'
          viewTweet={viewTweet}
          solid={retweeted}
          pop
          onClick={handleRetweet}
        />
        <TweetShare
          userId={userId}
          tweetId={tweetId}
          viewTweet={viewTweet}
          post={shared}
        />
      </div>
    </>
  );
}
