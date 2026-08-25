import Link from 'next/link';
import { motion } from 'framer-motion';
import cn from 'clsx';
import { LinkifiedText } from '@components/ui/linkified-text';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { TweetReplyModal } from '@components/modal/tweet-reply-modal';
import { ImagePreview } from '@components/input/image-preview';
import { StoryAvatar } from '@components/stories/story-avatar';
import { UserTooltip } from '@components/user/user-tooltip';
import { UserName } from '@components/user/user-name';
import { variants } from '@components/tweet/tweet';
import { TweetActions } from '@components/tweet/tweet-actions';
import { TweetAudioPlayer } from '@components/tweet/tweet-audio';
import { TweetStats } from '@components/tweet/tweet-stats';
import { TweetDate } from '@components/tweet/tweet-date';
import type { RefObject } from 'react';
import type { User } from '@lib/types/user';
import type { Tweet } from '@lib/types/tweet';

type ViewTweetProps = Tweet & {
  user: User;
  viewTweetRef?: RefObject<HTMLElement>;
};

export function ViewTweet(tweet: ViewTweetProps): JSX.Element {
  const {
    id: tweetId,
    text,
    images = [],
    audio,
    parent,
    userLikes = [],
    createdBy,
    createdAt,
    userRetweets = [],
    userReplies = 0,
    edited,
    viewTweetRef,
    user: tweetUserData
  } = tweet;

  const {
    id: ownerId,
    name,
    username,
    verified,
    gender,
    photoURL
  } = tweetUserData;

  const { user } = useAuth();
  const { t } = useLanguage();

  const { open, openModal, closeModal } = useModal();

  const tweetLink = `/tweet/${tweetId}`;

  const userId = user?.id as string;

  const isOwner = userId === createdBy;

  const reply = !!parent;

  const { id: parentId, username: parentUsername = username } = parent ?? {};

  return (
    <motion.article
      className={cn(
        `accent-tab glass-card relative flex cursor-default flex-col gap-3 border-b
         border-light-border px-4 py-3 outline-none dark:border-dark-border`,
        reply && 'scroll-m-[3.25rem] pt-0'
      )}
      {...variants}
      animate={{ ...variants.animate, transition: { duration: 0.2 } }}
      exit={undefined}
      ref={viewTweetRef}
    >
      <Modal
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl max-w-xl w-full mt-8 overflow-hidden'
        open={open}
        closeModal={closeModal}
      >
        <TweetReplyModal tweet={tweet} closeModal={closeModal} />
      </Modal>
      <div className='grid grid-cols-[auto,1fr] gap-3'>
        <div className='flex flex-col items-center gap-2'>
          {reply && (
            <i className='hover-animation h-2 w-0.5 bg-light-line-reply dark:bg-dark-line-reply' />
          )}
          <UserTooltip avatar {...tweetUserData}>
            <StoryAvatar
              user={{ id: ownerId, name, username, photoURL }}
              size={48}
            />
          </UserTooltip>
        </div>
        <div className='flex min-w-0 flex-col gap-3'>
          <div className='flex justify-between gap-2'>
            <UserTooltip {...tweetUserData}>
              <UserName
                className='-mb-1'
                name={name}
                username={username}
                verified={verified}
              />
            </UserTooltip>
            <TweetActions
              viewTweet
              isOwner={isOwner}
              ownerId={ownerId}
              tweetId={tweetId}
              parentId={parentId}
              username={username}
              hasImages={!!images}
              hasAudio={!!audio}
              text={text}
              createdBy={createdBy}
            />
          </div>
          {reply && (
            <p className='text-light-secondary dark:text-dark-secondary'>
              {t('home.replyTo')}{' '}
              <Link href={`/user/${parentUsername}`}>
                <a className='custom-underline text-main-accent-text'>
                  @{parentUsername}
                </a>
              </Link>
            </p>
          )}
          {text && (
            <p
              dir='auto'
              className='user-text whitespace-pre-line break-words text-2xl'
            >
              <LinkifiedText text={text} />
            </p>
          )}
          {images && (
            <ImagePreview
              viewTweet
              imagesPreview={images}
              previewCount={images.length}
            />
          )}
          {audio && <TweetAudioPlayer audio={audio} />}
          <div className='border-b border-light-border pb-2 dark:border-dark-border'>
            <TweetDate
              viewTweet
              tweetLink={tweetLink}
              createdAt={createdAt}
              edited={!!edited}
            />
            <TweetStats
              viewTweet
              reply={reply}
              userId={userId}
              isOwner={isOwner}
              tweetId={tweetId}
              userLikes={userLikes}
              userRetweets={userRetweets}
              userReplies={userReplies}
              openModal={openModal}
              shared={{
                id: tweetId,
                kind: 'tweet',
                authorName: name ?? null,
                authorUsername: username ?? null,
                authorPhoto: photoURL ?? null,
                text: text ?? null,
                // للفيديو: استخدم صورة البوستر وليس ملف الفيديو الخام
                thumbnail: images?.[0]?.thumbnail ?? images?.[0]?.src ?? null
              }}
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
