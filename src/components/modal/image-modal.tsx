/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { preventBubbling } from '@lib/utils';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { CustomVideoPlayer } from '@components/ui/custom-video-player';
import { backdrop, modal } from './modal';
import type { VariantLabels } from 'framer-motion';
import type { ImageData } from '@lib/types/file';
import type { IconName } from '@components/ui/hero-icon';

type ImageModalProps = {
  tweet?: boolean;
  imageData: ImageData;
  previewCount: number;
  selectedIndex?: number;
  handleNextIndex?: (type: 'prev' | 'next') => () => void;
  onClose?: () => void;
};

type ArrowButton = ['prev' | 'next', string | null, IconName];

const arrowButtons: Readonly<ArrowButton[]> = [
  ['prev', null, 'ArrowLeftIcon'],
  ['next', 'order-1', 'ArrowRightIcon']
];

export function ImageModal({
  tweet,
  imageData,
  previewCount,
  selectedIndex,
  handleNextIndex,
  onClose
}: ImageModalProps): JSX.Element {
  const [indexes, setIndexes] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const { src, alt, type, thumbnail } = imageData;

  const isVideo = type?.includes('video');
  const saveMedia = async (): Promise<void> => {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error('download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = alt || (isVideo ? 'aite-video' : 'aite-image');
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Download attribute provides the browser fallback when a remote bucket
      // does not allow an in-memory fetch.
      const link = document.createElement('a');
      link.href = src;
      link.download = alt || 'aite-media';
      link.click();
    }
  };

  const requireArrows = handleNextIndex && previewCount > 1;

  useEffect(() => {
    if (
      tweet &&
      selectedIndex !== undefined &&
      !indexes.includes(selectedIndex)
    ) {
      setLoading(true);
      setIndexes([...indexes, selectedIndex]);
    }

    const media = isVideo ? document.createElement('video') : new Image();

    media.src = src;

    const handleLoadingCompleted = (): void => setLoading(false);

    if (isVideo) media.onloadeddata = handleLoadingCompleted;
    else media.onload = handleLoadingCompleted;
  }, [...(tweet && previewCount > 1 ? [src] : [])]);

  useEffect(() => {
    if (!requireArrows) return;

    const handleKeyDown = ({ key }: KeyboardEvent): void => {
      const callback =
        key === 'ArrowLeft'
          ? handleNextIndex('prev')
          : key === 'ArrowRight'
          ? handleNextIndex('next')
          : null;

      if (callback) callback();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNextIndex]);

  return (
    <>
      {requireArrows &&
        arrowButtons.map(([name, className, iconName]) => (
          <Button
            className={cn(
              `absolute z-10 hover:bg-light-primary/10 active:bg-light-primary/20
               dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20`,
              name === 'prev' ? 'left-2' : 'right-2',
              className
            )}
            onClick={preventBubbling(handleNextIndex(name))}
            key={name}
          >
            <HeroIcon iconName={iconName} />
          </Button>
        ))}
      <AnimatePresence mode='wait'>
        {loading ? (
          <motion.div
            className='mx-auto'
            {...backdrop}
            exit={tweet ? (backdrop.exit as VariantLabels) : undefined}
            transition={{ duration: 0.15 }}
          >
            <Loading iconClassName='w-20 h-20' />
          </motion.div>
        ) : (
          <motion.div className='relative mx-auto' {...modal} key={src}>
            {isVideo ? (
              <div className='group relative flex max-w-3xl'>
                <CustomVideoPlayer
                  className={cn(
                    'max-h-[75vh] rounded-md md:max-h-[80vh]',
                    loading ? 'hidden' : 'block'
                  )}
                  videoClassName='max-h-[75vh] object-contain md:max-h-[80vh]'
                  src={src}
                  poster={thumbnail}
                />
              </div>
            ) : (
              <picture className='group relative flex max-w-3xl'>
                <source srcSet={src} type='image/*' />
                <img
                  className='max-h-[75vh] rounded-md object-contain md:max-h-[80vh]'
                  src={src}
                  alt={alt}
                  onClick={preventBubbling()}
                />
              </picture>
            )}
            <div className='absolute right-3 top-3 z-20 flex items-center gap-2' dir='ltr'>
              <button
                type='button'
                aria-label='حفظ الوسيط على الجهاز'
                className='flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/80 active:scale-95'
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void saveMedia();
                }}
              >
                <HeroIcon className='h-5 w-5' iconName='ArrowDownTrayIcon' />
              </button>
              {onClose && (
                <button
                  type='button'
                  aria-label='إغلاق المعاينة'
                  onClick={onClose}
                  className='flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/80 active:scale-95'
                >
                  <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
