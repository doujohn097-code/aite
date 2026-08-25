import cn from 'clsx';
import { useRouter } from 'next/router';
import { useModal } from '@lib/hooks/useModal';
import { useStoryRing } from '@lib/hooks/useStoryRing';
import { useLanguage } from '@lib/context/language-context';
import { useOnlineStatus } from '@lib/presence-store';
import { NextImage } from '@components/ui/next-image';
import { Modal } from '@components/modal/modal';
import { ImageModal } from '@components/modal/image-modal';
import { StoryRing } from '@components/stories/story-ring';
import type { ImageData } from '@lib/types/file';
import type { User } from '@lib/types/user';

type UserHomeAvatarProps = {
  profileData?: ImageData | null;
  user?: User | null;
  className?: string;
};

export function UserHomeAvatar({
  profileData,
  user,
  className
}: UserHomeAvatarProps): JSX.Element {
  const { open, openModal, closeModal } = useModal();
  const { push } = useRouter();
  const { hasStory, unseen, color } = useStoryRing(user);
  const ringColor = color ?? '#3b82f6';
  const { t } = useLanguage();
  const online = useOnlineStatus(user?.username);

  const imageSrc = user?.photoURL ?? profileData?.src ?? null;
  const imageAlt = user?.name ?? profileData?.alt ?? '';

  const handleClick = (): void => {
    if (hasStory && user) void push(`/stories/${user.id}`);
    else if (imageSrc) openModal();
  };

  return (
    <div className={cn('inline-block overflow-visible', className)}>
      <Modal open={open} closeModal={closeModal}>
        <ImageModal
          imageData={{ src: imageSrc, alt: imageAlt } as ImageData}
          previewCount={1}
          onClose={closeModal}
        />
      </Modal>
      <button
        type='button'
        onClick={handleClick}
        disabled={!imageSrc && !hasStory}
        className='group relative rounded-full'
      >
        {hasStory && (
          <StoryRing
            color={ringColor}
            animate={unseen}
            className={cn(
              'pointer-events-none absolute -inset-2 xs:-inset-2.5',
              !unseen && 'opacity-45'
            )}
          />
        )}
        <div className='aspect-square w-24 overflow-hidden rounded-full bg-main-background xs:w-32 sm:w-36'>
          {imageSrc ? (
            <NextImage
              useSkeleton
              className='relative h-full w-full'
              imgClassName='rounded-full transition duration-200 group-hover:brightness-90'
              src={imageSrc}
              alt={imageAlt}
              layout='fill'
              key={imageSrc}
            />
          ) : (
            <div className='h-full w-full rounded-full bg-main-sidebar-background' />
          )}
        </div>
        {online && (
          <span
            className='absolute bottom-1 left-1 z-10 h-4 w-4 rounded-full bg-emerald-400
                       shadow-[0_0_6px_2px_rgba(52,211,153,0.9)] ring-2 ring-main-background'
            title={t('common.online')}
          />
        )}
      </button>
    </div>
  );
}
