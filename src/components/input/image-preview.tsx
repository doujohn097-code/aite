import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { useModal } from '@lib/hooks/useModal';
import { preventBubbling } from '@lib/utils';
import { ImageModal } from '@components/modal/image-modal';
import { Modal } from '@components/modal/modal';
import { CustomVideoPlayer } from '@components/ui/custom-video-player';
import { NextImage } from '@components/ui/next-image';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import type { MotionProps } from 'framer-motion';
import type { ImagesPreview, ImageData } from '@lib/types/file';

type ImagePreviewProps = {
  tweet?: boolean;
  viewTweet?: boolean;
  chat?: boolean;
  previewCount: number;
  imagesPreview: ImagesPreview;
  removeImage?: (targetId: string) => () => void;
};

const variants: MotionProps = {
  initial: { opacity: 0, scale: 0.5 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3 }
  },
  exit: { opacity: 0, scale: 0.5 },
  transition: { type: 'spring', duration: 0.5 }
};

type PostImageBorderRadius = Record<number, string[]>;

const postImageBorderRadius: Readonly<PostImageBorderRadius> = {
  1: ['rounded-2xl'],
  2: ['rounded-tl-2xl rounded-bl-2xl', 'rounded-tr-2xl rounded-br-2xl'],
  3: ['rounded-tl-2xl rounded-bl-2xl', 'rounded-tr-2xl', 'rounded-br-2xl'],
  4: ['rounded-tl-2xl', 'rounded-tr-2xl', 'rounded-bl-2xl', 'rounded-br-2xl']
};

function activeSlideIndex(scroller: HTMLElement): number {
  const mid = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  Array.from(scroller.children).forEach((child, index) => {
    if (!(child instanceof HTMLElement)) return;
    const box = child.getBoundingClientRect();
    const dist = Math.abs(box.left + box.width / 2 - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

export function ImagePreview({
  tweet,
  viewTweet,
  chat,
  previewCount,
  imagesPreview,
  removeImage
}: ImagePreviewProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [slide, setSlide] = useState(0);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ x: 0, y: 0, moved: false });

  useEffect(() => {
    let cancelled = false;
    imagesPreview.forEach((item) => {
      if (item.type?.includes('video')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = item.src;
        video.onloadedmetadata = (): void => {
          if (cancelled || !video.videoWidth || !video.videoHeight) return;
          setAspects((prev) =>
            prev[item.id]
              ? prev
              : { ...prev, [item.id]: video.videoWidth / video.videoHeight }
          );
        };
        return;
      }
      const image = new Image();
      image.onload = (): void => {
        if (cancelled || !image.naturalWidth || !image.naturalHeight) return;
        setAspects((prev) =>
          prev[item.id]
            ? prev
            : {
                ...prev,
                [item.id]: image.naturalWidth / image.naturalHeight
              }
        );
      };
      image.src = item.src;
    });
    return (): void => {
      cancelled = true;
    };
  }, [imagesPreview]);

  const { open, openModal, closeModal } = useModal();

  useEffect(() => {
    const imageData = imagesPreview[selectedIndex];
    setSelectedImage(imageData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const handleSelectedImage = (index: number) => (): void => {
    if (dragRef.current.moved) return;
    setSelectedIndex(index);
    openModal();
  };

  const handleNextIndex = (type: 'prev' | 'next') => () => {
    const nextIndex =
      type === 'prev'
        ? selectedIndex === 0
          ? previewCount - 1
          : selectedIndex - 1
        : selectedIndex === previewCount - 1
        ? 0
        : selectedIndex + 1;

    setSelectedIndex(nextIndex);
  };

  const isTweet = tweet ?? viewTweet;
  const feedCarousel = Boolean(isTweet && !removeImage && !chat);

  const lightbox = (
    <Modal
      modalClassName={cn(
        'flex justify-center w-full items-center relative',
        isTweet && 'h-full'
      )}
      open={open}
      closeModal={closeModal}
      closePanelOnClick
    >
      <ImageModal
        tweet={isTweet}
        imageData={selectedImage as ImageData}
        previewCount={previewCount}
        selectedIndex={selectedIndex}
        gallery={imagesPreview}
        handleNextIndex={handleNextIndex}
        onSelectIndex={setSelectedIndex}
        onClose={closeModal}
      />
    </Modal>
  );

  if (feedCarousel) {
    const current = imagesPreview[slide] ?? imagesPreview[0];
    const rawAspect = current ? aspects[current.id] : undefined;
    const tall = rawAspect !== undefined && rawAspect < 4 / 5;
    const aspect =
      rawAspect === undefined ? undefined : Math.max(rawAspect, 4 / 5);
    const fitClass = tall
      ? 'block h-full w-full object-cover'
      : aspect
      ? 'block h-full w-full object-contain'
      : 'block h-auto w-full';

    return (
      <div
        className='relative w-full overflow-hidden'
        style={aspect ? { aspectRatio: `${aspect}` } : undefined}
        onClick={preventBubbling()}
      >
        {lightbox}
        <div
          ref={scrollerRef}
          className={cn('flex h-full w-full', previewCount > 1 && 'media-snap')}
          onScroll={(event): void => {
            setSlide(activeSlideIndex(event.currentTarget));
          }}
          onPointerDown={(event): void => {
            dragRef.current = {
              x: event.clientX,
              y: event.clientY,
              moved: false
            };
          }}
          onPointerMove={(event): void => {
            if (
              Math.abs(event.clientX - dragRef.current.x) > 12 &&
              Math.abs(event.clientX - dragRef.current.x) >
                Math.abs(event.clientY - dragRef.current.y)
            )
              dragRef.current.moved = true;
          }}
        >
          {imagesPreview.map(({ id, src, alt, thumbnail, type }, index) => {
            const isVideo = type?.includes('video');
            return (
              <div key={id} className='media-slide'>
                {isVideo ? (
                  <CustomVideoPlayer
                    src={src}
                    poster={thumbnail}
                    className='h-full w-full !bg-transparent'
                    videoClassName={
                      tall
                        ? 'h-full w-full object-cover'
                        : 'h-full w-full object-contain'
                    }
                  />
                ) : (
                  <button
                    type='button'
                    className='relative block h-full w-full'
                    onClick={preventBubbling(handleSelectedImage(index))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={alt}
                      className={fitClass}
                      draggable={false}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {previewCount > 1 && (
          <>
            <span
              className='absolute end-3 top-3 rounded-full bg-black/55 px-2 py-0.5
                         text-[11px] font-semibold text-white backdrop-blur-sm'
            >
              {slide + 1}/{previewCount}
            </span>
            <div className='pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5'>
              {imagesPreview.map(({ id }, index) => (
                <span
                  key={id}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    index === slide ? 'w-4 bg-white' : 'w-1.5 bg-white/45'
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 grid-rows-2 rounded-2xl',
        chat
          ? 'h-[42vw] xs:h-[28vw] md:h-[180px]'
          : viewTweet
          ? 'h-[51vw] xs:h-[42vw] md:h-[305px]'
          : 'h-[42vw] xs:h-[37vw] md:h-[271px]',
        isTweet ? (chat ? 'gap-0.5' : 'mt-2 gap-0.5') : 'gap-3'
      )}
    >
      {lightbox}
      <AnimatePresence mode='popLayout'>
        {imagesPreview.map(({ id, src, alt, thumbnail }, index) => {
          const isVideo = imagesPreview[index].type?.includes('video');

          return (
            <motion.button
              type='button'
              className={cn(
                'accent-tab group relative transition-shadow',
                isTweet
                  ? postImageBorderRadius[previewCount][index]
                  : 'rounded-2xl',
                {
                  'col-span-2 row-span-2': previewCount === 1,
                  'row-span-2':
                    previewCount === 2 || (index === 0 && previewCount === 3)
                }
              )}
              {...variants}
              onClick={preventBubbling(handleSelectedImage(index))}
              layout={!isTweet ? true : false}
              key={id}
            >
              {isVideo ? (
                <>
                  <Button
                    className='visible absolute right-0 top-0 z-10 -translate-x-1 translate-y-1 
                               bg-light-primary/75 p-1 opacity-0 backdrop-blur-sm transition
                               hover:bg-image-preview-hover/75 group-hover:opacity-100 xs:invisible'
                  >
                    <HeroIcon className='h-5 w-5' iconName='ArrowUpRightIcon' />
                  </Button>
                  <CustomVideoPlayer
                    src={src}
                    poster={thumbnail}
                    className={cn(
                      'h-full w-full cursor-pointer',
                      isTweet
                        ? postImageBorderRadius[previewCount][index]
                        : 'rounded-2xl'
                    )}
                    videoClassName={cn(
                      isTweet
                        ? postImageBorderRadius[previewCount][index]
                        : 'rounded-2xl'
                    )}
                  />
                </>
              ) : (
                <NextImage
                  className='relative h-full w-full cursor-pointer transition 
                             hover:brightness-75 hover:duration-200'
                  imgClassName={cn(
                    isTweet
                      ? postImageBorderRadius[previewCount][index]
                      : 'rounded-2xl'
                  )}
                  previewCount={previewCount}
                  layout='fill'
                  src={src}
                  alt={alt}
                  useSkeleton={isTweet}
                />
              )}
              {removeImage && (
                <Button
                  className='group absolute left-0 top-0 translate-x-1 translate-y-1
                           bg-light-primary/75 p-1 backdrop-blur-sm 
                           hover:bg-image-preview-hover/75'
                  onClick={preventBubbling(removeImage(id))}
                >
                  <HeroIcon
                    className='h-5 w-5 text-white'
                    iconName='XMarkIcon'
                  />
                  <ToolTip className='translate-y-2' tip='إزالة' />
                </Button>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
