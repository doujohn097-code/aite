import { useState } from 'react';
import cn from 'clsx';
import { useArrayDocument } from '@lib/hooks/useArrayDocument';
import { useModal } from '@lib/hooks/useModal';
import { usersCollection } from '@lib/firebase/collections';
import { Modal } from '@components/modal/modal';
import { TweetStatsModal } from '@components/modal/tweet-stats-modal';
import { NumberStats } from '@components/tweet/number-stats';
import { UserCards } from '@components/user/user-cards';
import type { Tweet } from '@lib/types/tweet';

type viewTweetStats = Pick<Tweet, 'userRetweets' | 'userLikes'> & {
  likeMove: number;
  tweetMove: number;
  replyMove: number;
  currentLikes: number;
  currentTweets: number;
  currentReplies: number;
  isStatsVisible: boolean;
};

export type StatsType = 'retweets' | 'likes';

type Stats = [string, StatsType | null, number, number];

export function ViewTweetStats({
  likeMove,
  userLikes,
  tweetMove,
  replyMove,
  userRetweets,
  currentLikes,
  currentTweets,
  currentReplies,
  isStatsVisible
}: viewTweetStats): JSX.Element {
  const [statsType, setStatsType] = useState<StatsType | null>(null);

  const { open, openModal, closeModal } = useModal();

  const { data, loading } = useArrayDocument(
    statsType
      ? statsType === 'likes'
        ? userLikes ?? []
        : userRetweets ?? []
      : [],
    usersCollection,
    { disabled: !statsType }
  );

  const handleOpen = (type: StatsType) => (): void => {
    setStatsType(type);
    openModal();
  };

  const handleClose = (): void => {
    setStatsType(null);
    closeModal();
  };

  const allStats: Readonly<Stats[]> = [
    ['رد', null, replyMove, currentReplies],
    ['إعادة نشر', 'retweets', tweetMove, currentTweets],
    ['إعجاب', 'likes', likeMove, currentLikes]
  ];

  return (
    <>
      <Modal
        modalClassName='relative bg-main-background rounded-2xl max-w-xl w-full 
                        h-[672px] overflow-hidden rounded-2xl'
        open={open}
        closeModal={handleClose}
      >
        <TweetStatsModal statsType={statsType} handleClose={handleClose}>
          <UserCards
            follow
            type={statsType as StatsType}
            data={data}
            loading={loading}
          />
        </TweetStatsModal>
      </Modal>
      {isStatsVisible && (
        <div
          className='flex gap-4 px-1 py-4 text-light-secondary dark:text-dark-secondary
                     [&>button>span]:font-bold [&>button>span]:text-light-primary
                     dark:[&>button>span]:text-dark-primary'
        >
          {allStats.map(
            ([title, type, move, stats], index) =>
              !!stats && (
                <button
                  className={cn(
                    `hover-animation mb-[3px] mt-0.5 flex h-4 items-center gap-1 border-b 
                     border-b-transparent outline-none hover:border-b-light-primary 
                     focus-visible:border-b-light-primary dark:hover:border-b-dark-primary
                     dark:focus-visible:border-b-dark-primary`,
                    index === 0 && 'cursor-not-allowed'
                  )}
                  key={title}
                  onClick={type ? handleOpen(type) : undefined}
                >
                  <NumberStats move={move} stats={stats} />
                  <p>
                    {index === 0
                      ? stats > 1
                        ? 'ردود'
                        : 'رد'
                      : index === 2
                      ? stats > 1
                        ? 'إعجابات'
                        : 'إعجاب'
                      : stats > 1
                      ? 'إعادات نشر'
                      : 'إعادة نشر'}
                  </p>
                </button>
              )
          )}
        </div>
      )}
    </>
  );
}
