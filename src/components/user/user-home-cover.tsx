import { useModal } from '@lib/hooks/useModal';
import { useTheme } from '@lib/context/theme-context';
import { themesMeta } from '@lib/types/theme';
import { Button } from '@components/ui/button';
import { NextImage } from '@components/ui/next-image';
import { Modal } from '@components/modal/modal';
import { ImageModal } from '@components/modal/image-modal';
import type { ImageData } from '@lib/types/file';

type UserHomeCoverProps = {
  coverData?: ImageData | null;
};

export function UserHomeCover({ coverData }: UserHomeCoverProps): JSX.Element {
  const { open, openModal, closeModal } = useModal();
  const { theme } = useTheme();

  const { wallpaper } = themesMeta[theme];

  return (
    <div className='mt-0.5 h-36 xs:h-48 sm:h-52'>
      <Modal open={open} closeModal={closeModal}>
        <ImageModal
          imageData={coverData as ImageData}
          previewCount={1}
          onClose={closeModal}
        />
      </Modal>
      {coverData ? (
        <Button
          className='accent-tab relative h-full w-full rounded-none p-0 transition hover:brightness-75'
          onClick={openModal}
        >
          <NextImage
            useSkeleton
            layout='fill'
            imgClassName='object-cover'
            src={coverData.src}
            alt={coverData.alt}
            key={coverData.src}
          />
        </Button>
      ) : (
        <div className='relative h-full overflow-hidden bg-light-line-reply dark:bg-dark-line-reply'>
          {wallpaper ? (
            <>
              <div
                className='h-full w-full bg-cover bg-center'
                style={{ backgroundImage: `url('${wallpaper}')` }}
              />
              <span
                aria-hidden
                className='absolute inset-0 bg-gradient-to-t from-main-background/70 to-transparent'
              />
            </>
          ) : (
            <div className='h-full w-full bg-gradient-to-tr from-main-accent/25 via-main-accent/10 to-transparent' />
          )}
        </div>
      )}
    </div>
  );
}
