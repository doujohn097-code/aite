import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { LinkifiedText } from '@components/ui/linkified-text';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import { useModal } from '@lib/hooks/useModal';
import { delayScroll } from '@lib/utils';
import { Modal } from '@components/modal/modal';
import { TweetReplyModal } from '@components/modal/tweet-reply-modal';
import { ImagePreview } from '@components/input/image-preview';
import { TweetAudioPlayer } from './tweet-audio';
import { StoryAvatar } from '@components/stories/story-avatar';
import { UserTooltip } from '@components/user/user-tooltip';
import { UserName } from '@components/user/user-name';
import { TweetActions } from './tweet-actions';
import { TweetStatus } from './tweet-status';
import { TweetStats } from './tweet-stats';
import { TweetDate } from './tweet-date';
import type { Variants } from 'framer-motion';
import type { Tweet } from '@lib/types/tweet';
import type { User } from '@lib/types/user';

export type TweetProps = Tweet & {
  user: User;
  modal?: boolean;
  pinned?: boolean;
  profile?: User | null;
  parentTweet?: boolean;
};

export const variants: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.15 } }
};

export function Tweet(tweet: TweetProps): JSX.Element {
  const {
    id: tweetId,
    text,
    modal,
    images,
    audio,
    parent,
    pinned,
    profile,
    userLikes = [],
    createdBy,
    createdAt,
    parentTweet,
    userReplies = 0,
    userRetweets = [],
    edited,
    user: tweetUserData
  } = tweet;

  const {
    id: ownerId,
    name,
    username,
    verified,
    gender,
    photoURL
  } = tweetUserData ?? {
    id: createdBy,
    name: '',
    username: '',
    verified: false,
    gender: null,
    photoURL: '/assets/default-avatar.png'
  };

  const { user } = useAuth();
  const { t } = useLanguage();

  const { open, openModal, closeModal } = useModal();

  const tweetLink = `/tweet/${tweetId}`;

  const userId = user?.id as string;

  const isOwner = userId === createdBy;
  // A block is enforced at the rendering boundary too, so blocked posts vanish
  // from home feeds, search, profile tabs and embedded tweet views.
  const isBlocked = !!ownerId && user?.blockedUsers?.includes(ownerId);

  const { id: parentId, username: parentUsername = username } = parent ?? {};

  const {
    id: profileId,
    name: profileName,
    username: profileUsername
  } = profile ?? {};

  const reply = !!parent;
  const tweetIsRetweeted = userRetweets.includes(profileId ?? '');

  if (isBlocked) return <></>;

  return (
    <motion.article
      {...(!modal ? { ...variants, layout: 'position' } : {})}
      animate={{
        ...variants.animate,
        ...(parentTweet && { transition: { duration: 0.2 } })
      }}
    >
      <Modal
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl max-w-xl w-full my-8 overflow-hidden'
        open={open}
        closeModal={closeModal}
      >
        <TweetReplyModal tweet={tweet} closeModal={closeModal} />
      </Modal>
      <Link href={tweetLink} scroll={!reply}>
        <a
          className={cn(
            `accent-tab hover-card glass-card relative flex flex-col 
             gap-y-4 px-4 py-3 outline-none duration-200`,
            parentTweet
              ? 'mt-0.5 pb-0 pt-2.5'
              : 'border-b border-light-border dark:border-dark-border'
          )}
          draggable={false}
          onClick={delayScroll(200)}
        >
          <div className='grid grid-cols-[auto,1fr] gap-x-3 gap-y-1'>
            <AnimatePresence initial={false}>
              {modal ? null : pinned ? (
                <TweetStatus type='pin'>
                  <p className='text-sm font-bold'>{t('home.pinned')}</p>
                </TweetStatus>
              ) : (
                tweetIsRetweeted && (
                  <TweetStatus type='tweet'>
                    <Link href={profileUsername as string}>
                      <a className='custom-underline truncate text-sm font-bold'>
                        {userId === profileId
                          ? t('home.youReposted')
                          : t('home.reposted', { name: profileName ?? '' })}
                      </a>
                    </Link>
                  </TweetStatus>
                )
              )}
            </AnimatePresence>
            <div className='flex flex-col items-center gap-2'>
              <UserTooltip avatar modal={modal} {...tweetUserData}>
                <StoryAvatar
                  user={{
                    id: ownerId,
                    name,
                    username,
                    photoURL
                  }}
                  size={48}
                />
              </UserTooltip>
              {parentTweet && (
                <i className='hover-animation h-full w-0.5 bg-light-line-reply dark:bg-dark-line-reply' />
              )}
            </div>
            <div className='flex min-w-0 flex-col'>
              <div className='flex justify-between gap-2 text-light-secondary dark:text-dark-secondary'>
                <div className='flex gap-1 truncate xs:overflow-visible xs:whitespace-normal'>
                  <UserTooltip modal={modal} {...tweetUserData}>
                    <UserName
                      name={name}
                      username={username}
                      verified={verified}
                      className='text-light-primary dark:text-dark-primary'
                    />
                  </UserTooltip>
                  <TweetDate
                    tweetLink={tweetLink}
                    createdAt={createdAt}
                    edited={!!edited}
                  />
                </div>
                <div className='shrink-0'>
                  {!modal && (
                    <TweetActions
                      isOwner={isOwner}
                      ownerId={ownerId}
                      tweetId={tweetId}
                      parentId={parentId}
                      username={username}
                      hasImages={!!images}
                      hasAudio={!!audio}
                      text={text}
                      images={images}
                      createdBy={createdBy}
                    />
                  )}
                </div>
              </div>
              {(reply || modal) && (
                <p
                  className={cn(
                    'text-light-secondary dark:text-dark-secondary',
                    modal && 'order-1 my-2'
                  )}
                >
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
                  className='user-text selectable-text whitespace-pre-line break-words'
                >
                  <LinkifiedText text={text} />
                </p>
              )}
              <div className='mt-1 flex flex-col gap-2'>
                {images && (
                  <ImagePreview
                    tweet
                    imagesPreview={images}
                    previewCount={images.length}
                  />
                )}
                {audio && <TweetAudioPlayer audio={audio} />}
                {!modal && (
                  <TweetStats
                    reply={reply}
                    userId={userId}
                    isOwner={isOwner}
                    tweetId={tweetId}
                    userLikes={userLikes}
                    userReplies={userReplies}
                    userRetweets={userRetweets}
                    openModal={!parent ? openModal : undefined}
                    shared={{
                      id: tweetId,
                      kind: 'tweet',
                      authorName: name ?? null,
                      authorUsername: username ?? null,
                      authorPhoto: photoURL ?? null,
                      text: text ?? null,
                      // للفيديو: استخدم صورة البوستر وليس ملف الفيديو الخام
                      thumbnail:
                        images?.[0]?.thumbnail ?? images?.[0]?.src ?? null
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </a>
      </Link>
    </motion.article>
  );
}
