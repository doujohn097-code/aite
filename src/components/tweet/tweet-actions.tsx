import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { tweetsCollection } from '@lib/firebase/collections';
import {
  editTweet,
  removeTweet,
  manageReply,
  manageTotalReplies,
  manageFollow,
  managePinnedTweet,
  manageTotalTweets,
  manageTotalPhotos
} from '@lib/firebase/utils';
import { copyText } from '@lib/copy-text';
import { useLanguage } from '@lib/context/language-context';
import { delayScroll, preventBubbling, sleep } from '@lib/utils';
import {
  EditContentModal,
  type EditContentSave
} from '@components/modal/edit-content-modal';
import type { ImagesPreview } from '@lib/types/file';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { Button } from '@components/ui/button';
import { OverflowMenu } from '@components/ui/overflow-menu';
import { ToolTip } from '@components/ui/tooltip';
import { HeroIcon } from '@components/ui/hero-icon';
import { CustomIcon } from '@components/ui/custom-icon';
import type { Variants } from 'framer-motion';
import type { Tweet } from '@lib/types/tweet';

export const variants: Variants = {
  initial: { opacity: 0, y: -25 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', duration: 0.4 }
  },
  exit: { opacity: 0, y: -25, transition: { duration: 0.2 } }
};

type TweetActionsProps = Pick<Tweet, 'createdBy'> & {
  isOwner: boolean;
  ownerId: string;
  tweetId: string;
  username: string;
  parentId?: string;
  hasImages: boolean;
  hasAudio?: boolean;
  text?: string | null;
  font?: string | null;
  images?: ImagesPreview | null;
  viewTweet?: boolean;
};

export function TweetActions({
  isOwner,
  ownerId,
  tweetId,
  parentId,
  username,
  hasImages,
  hasAudio,
  text,
  font,
  images,
  viewTweet,
  createdBy
}: TweetActionsProps): JSX.Element | null {
  const { user, isAdmin } = useAuth();
  const { push } = useRouter();
  const { t } = useLanguage();

  const {
    open: removeOpen,
    openModal: removeOpenModal,
    closeModal: removeCloseModal
  } = useModal();

  const {
    open: pinOpen,
    openModal: pinOpenModal,
    closeModal: pinCloseModal
  } = useModal();

  const {
    open: editOpen,
    openModal: editOpenModal,
    closeModal: editCloseModal
  } = useModal();

  const tweetIsPinned = user?.pinnedTweet === tweetId;

  const currentPinModalData = useMemo(
    () =>
      tweetIsPinned
        ? {
            title: t('tweet.unpinTitle'),
            description: t('tweet.unpinBody'),
            mainBtnLabel: t('tweet.unpin')
          }
        : {
            title: t('tweet.pinTitle'),
            description: t('tweet.pinBody'),
            mainBtnLabel: t('tweet.pin')
          },
    [t, tweetIsPinned]
  );

  const handleCopy = async (): Promise<void> => {
    const ok = await copyText(text ?? '');
    toast[ok ? 'success' : 'error'](ok ? t('common.copied') : t('common.copyFailed'));
  };

  if (!user) return null;

  const { id: userId, following = [] } = user;

  const isInAdminControl = isAdmin && !isOwner;

  const handleRemove = async (): Promise<void> => {
    if (viewTweet)
      if (parentId) {
        const parentSnapshot = await getDoc(doc(tweetsCollection, parentId));
        if (parentSnapshot.exists()) {
          await push(`/tweet/${parentId}`, undefined, { scroll: false });
          delayScroll(200)();
          await sleep(50);
        } else await push('/home');
      } else await push('/home');

    await Promise.all([
      removeTweet(tweetId),
      parentId
        ? manageTotalReplies('decrement', ownerId)
        : manageTotalTweets('decrement', ownerId),
      hasImages && manageTotalPhotos('decrement', createdBy),
      parentId && manageReply('decrement', parentId)
    ]);

    toast.success(
      isInAdminControl
        ? t('tweet.deletedOther', { username })
        : t('tweet.deleted')
    );

    removeCloseModal();
  };

  const handleEdit = async ({
    text: nextText,
    images: nextImages,
    font: nextFont
  }: EditContentSave): Promise<void> => {
    await editTweet(tweetId, userId, nextText, {
      allowEmpty: !!hasAudio,
      images: nextImages,
      font: nextFont
    });
    toast.success(t('tweet.saved'));
  };

  const handlePin = async (): Promise<void> => {
    if (!userId) return;
    await managePinnedTweet(tweetIsPinned ? 'unpin' : 'pin', userId, tweetId);
    toast.success(tweetIsPinned ? t('tweet.unpinned') : t('tweet.pinned'));
    pinCloseModal();
  };

  const handleFollow =
    (closeMenu: () => void, ...args: Parameters<typeof manageFollow>) =>
    async (): Promise<void> => {
      if (!userId) return;
      const [type, , targetUserId] = args;

      closeMenu();
      await manageFollow(type, userId, targetUserId);

      toast.success(
        type === 'follow'
          ? t('tweet.followed', { username })
          : t('tweet.unfollowed', { username })
      );
    };

  const userIsFollowed = following.includes(createdBy);

  return (
    <>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={removeOpen}
        closeModal={removeCloseModal}
      >
        <ActionModal
          title={t('tweet.deleteTitle')}
          description={
            isInAdminControl
              ? t('tweet.deleteBodyOther', { username })
              : t('tweet.deleteBody')
          }
          mainBtnClassName='bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/75 accent-tab
                            focus-visible:bg-accent-red/90'
          mainBtnLabel={t('common.delete')}
          focusOnMainBtn
          action={handleRemove}
          closeModal={removeCloseModal}
        />
      </Modal>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={pinOpen}
        closeModal={pinCloseModal}
      >
        <ActionModal
          {...currentPinModalData}
          mainBtnClassName='bg-light-primary hover:bg-light-primary/90 active:bg-light-primary/80 dark:text-light-primary
                            dark:bg-light-border dark:hover:bg-light-border/90 dark:active:bg-light-border/75'
          focusOnMainBtn
          action={handlePin}
          closeModal={pinCloseModal}
        />
      </Modal>
      <EditContentModal
        open={editOpen}
        closeModal={editCloseModal}
        title={t('tweet.edit')}
        initialText={text ?? ''}
        initialFont={font}
        initialImages={images}
        mediaKind='images'
        allowEmpty={!!hasAudio}
        onSave={handleEdit}
      />
      <OverflowMenu
        aria-label={t('common.more')}
        buttonClassName='main-tab group rounded-full p-2 hover:bg-accent-blue/10
                         focus-visible:bg-accent-blue/10 focus-visible:!ring-accent-blue/80
                         active:bg-accent-blue/20'
        button={
          <div className='group relative'>
            <HeroIcon
              className='h-5 w-5 text-light-secondary group-hover:text-accent-blue
                         group-focus-visible:text-accent-blue dark:text-dark-secondary/80'
              iconName='EllipsisHorizontalIcon'
            />
            <ToolTip tip={t('common.more')} />
          </div>
        }
      >
        {(close): JSX.Element => (
          <>
            {isOwner && (
              <Button
                className='accent-tab flex w-full justify-start gap-3 rounded-none p-4 hover:bg-main-sidebar-background'
                onClick={preventBubbling(() => {
                  close();
                  editOpenModal();
                })}
              >
                <HeroIcon iconName='PencilSquareIcon' />
                {t('common.edit')}
              </Button>
            )}
            {!!text?.trim() && (
              <Button
                className='accent-tab flex w-full justify-start gap-3 rounded-none p-4 hover:bg-main-sidebar-background'
                onClick={preventBubbling(() => {
                  close();
                  void handleCopy();
                })}
              >
                <HeroIcon iconName='ClipboardDocumentIcon' />
                {t('tweet.copy')}
              </Button>
            )}
            {(isAdmin || isOwner) && (
              <Button
                className='accent-tab flex w-full justify-start gap-3 rounded-none p-4 text-accent-red hover:bg-main-sidebar-background'
                onClick={preventBubbling(() => {
                  close();
                  removeOpenModal();
                })}
              >
                <HeroIcon iconName='TrashIcon' />
                {t('common.delete')}
              </Button>
            )}
            {isOwner ? (
              <Button
                className='accent-tab flex w-full justify-start gap-3 rounded-none p-4 hover:bg-main-sidebar-background'
                onClick={preventBubbling(() => {
                  close();
                  pinOpenModal();
                })}
              >
                {tweetIsPinned ? (
                  <>
                    <CustomIcon iconName='PinOffIcon' />
                    {t('tweet.unpinFromProfile')}
                  </>
                ) : (
                  <>
                    <CustomIcon iconName='PinIcon' />
                    {t('tweet.pinToProfile')}
                  </>
                )}
              </Button>
            ) : userIsFollowed ? (
              <Button
                className='accent-tab flex w-full justify-start gap-3 rounded-none p-4 hover:bg-main-sidebar-background'
                onClick={preventBubbling(
                  handleFollow(close, 'unfollow', userId, createdBy)
                )}
              >
                <HeroIcon iconName='UserMinusIcon' />
                {t('tweet.unfollow', { username })}
              </Button>
            ) : (
              <Button
                className='accent-tab flex w-full justify-start gap-3 rounded-none p-4 hover:bg-main-sidebar-background'
                onClick={preventBubbling(
                  handleFollow(close, 'follow', userId, createdBy)
                )}
              >
                <HeroIcon iconName='UserPlusIcon' />
                {t('tweet.follow', { username })}
              </Button>
            )}
          </>
        )}
      </OverflowMenu>
    </>
  );
}
