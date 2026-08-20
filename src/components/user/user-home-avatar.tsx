import cn from 'clsx';
import { useRouter } from 'next/router';
import { useModal } from '@lib/hooks/useModal';
import { useStoryRing } from '@lib/hooks/useStoryRing';
import { useOnlineStatus } from '@lib/presence-store';
import { NextImage } from '@components/ui/next-image';
import { Modal } from '@components/modal/modal';
import { ImageModal } from '@components/modal/image-modal';
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
  const { hasStory, color } = useStoryRing(user);
  const ringColor = color ?? '#3b82f6';
  const online = useOnlineStatus(user?.username);

  const imageSrc = user?.photoURL ?? profileData?.src ?? null;
  const imageAlt = user?.name ?? profileData?.alt ?? '';

  const handleClick = (): void => {
    if (hasStory && user) void push(`/stories/${user.id}`);
    else if (imageSrc) openModal();
  };

  return (
    <div className={cn('inline-block', className)}>
      <Modal open={open} closeModal={closeModal}>
        <ImageModal
          imageData={{ src: imageSrc, alt: imageAlt } as ImageData}
          previewCount={1}
        />
      </Modal>
      <button
        type='button'
        onClick={handleClick}
        disabled={!imageSrc && !hasStory}
        className={cn(
          'group relative rounded-full transition',
          hasStory ? 'p-0.5' : 'p-0'
        )}
        style={
          hasStory
            ? {
                background: `linear-gradient(135deg, ${ringColor}, ${ringColor}80 60%, ${ringColor}40)`
              }
            : undefined
        }
      >
        <div
          className={cn(
            'aspect-square w-24 overflow-hidden rounded-full bg-main-background xs:w-32 sm:w-36',
            hasStory ? 'p-0.5' : 'p-0'
          )}
        >
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
            title='نشط الآن'
          />
        )}
      </button>
    </div>
  );
}
