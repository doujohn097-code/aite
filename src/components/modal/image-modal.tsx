/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { useLanguage } from '@lib/context/language-context';
import { downloadRemoteMedia } from '@lib/download-media';
import { preventBubbling } from '@lib/utils';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { CustomVideoPlayer } from '@components/ui/custom-video-player';
import { backdrop, modal } from './modal';
import type { VariantLabels } from 'framer-motion';
import type { ImageData, ImagesPreview } from '@lib/types/file';

type ImageModalProps = {
  tweet?: boolean;
  imageData: ImageData;
  previewCount: number;
  selectedIndex?: number;
  gallery?: ImagesPreview;
  handleNextIndex?: (type: 'prev' | 'next') => () => void;
  onSelectIndex?: (index: number) => void;
  onClose?: () => void;
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

export function ImageModal({
  tweet,
  imageData,
  previewCount,
  selectedIndex = 0,
  gallery,
  handleNextIndex,
  onSelectIndex,
  onClose
}: ImageModalProps): JSX.Element {
  const { t } = useLanguage();
  const [indexes, setIndexes] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const skipScrollRef = useRef(false);

  const slides =
    gallery && gallery.length > 1 ? gallery : [{ id: 'current', ...imageData }];
  const count = slides.length;
  const requirePager = count > 1;
  const current = slides[Math.min(selectedIndex, count - 1)] ?? imageData;
  const { src, alt, type, thumbnail } = current;
  const isVideo = type?.includes('video');

  const saveMedia = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await downloadRemoteMedia(src, { alt, type });
      if (ok === 'chrome') toast.success(t('media.savedChrome'));
      else if (ok) toast.success(t('media.savedOk'));
      else toast.error(t('media.saveFail'));
    } catch {
      toast.error(t('media.saveFail'));
    } finally {
      setSaving(false);
    }
  };

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
    if (isVideo) {
      media.onloadeddata = handleLoadingCompleted;
      media.onerror = handleLoadingCompleted;
    } else media.onload = handleLoadingCompleted;
  }, [...(tweet && previewCount > 1 ? [src] : [])]);

  useEffect(() => {
    if (!handleNextIndex || !requirePager) return;
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
  }, [handleNextIndex, requirePager]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    const child = el.children[selectedIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selectedIndex]);

  const goTo = (index: number): void => {
    onSelectIndex?.(index);
  };

  const slideMedia = (item: ImageData): JSX.Element => {
    const video = item.type?.includes('video');
    if (video)
      return (
        <CustomVideoPlayer
          className='max-h-[75vh] w-full rounded-md md:max-h-[80vh]'
          videoClassName='max-h-[75vh] w-full object-contain md:max-h-[80vh]'
          src={item.src}
          poster={item.thumbnail}
        />
      );
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className='max-h-[75vh] rounded-md object-contain md:max-h-[80vh]'
        src={item.src}
        alt={item.alt}
        draggable={false}
        onClick={preventBubbling()}
      />
    );
  };

  return (
    <>
      <AnimatePresence mode='wait'>
        {loading && !requirePager ? (
          <motion.div
            className='mx-auto'
            {...backdrop}
            exit={tweet ? (backdrop.exit as VariantLabels) : undefined}
            transition={{ duration: 0.15 }}
          >
            <Loading iconClassName='w-20 h-20' />
          </motion.div>
        ) : requirePager ? (
          <motion.div
            className='relative mx-auto w-[min(100vw,48rem)]'
            {...modal}
            onClick={preventBubbling()}
          >
            <div
              ref={scrollerRef}
              className='media-snap flex w-full'
              onScroll={(event): void => {
                const next = activeSlideIndex(event.currentTarget);
                if (next !== selectedIndex) {
                  skipScrollRef.current = true;
                  goTo(next);
                }
              }}
            >
              {slides.map((item, index) => (
                <div
                  key={item.id ?? index}
                  className='media-slide flex !h-[75vh] items-center justify-center'
                >
                  {slideMedia(item)}
                </div>
              ))}
            </div>
            <div className='pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center gap-1.5'>
              {slides.map((item, index) => (
                <button
                  type='button'
                  key={item.id ?? index}
                  aria-label={`${index + 1}`}
                  onClick={preventBubbling(() => goTo(index))}
                  className={cn(
                    'pointer-events-auto h-1.5 rounded-full transition-all',
                    index === selectedIndex
                      ? 'w-4 bg-white'
                      : 'w-1.5 bg-white/45'
                  )}
                />
              ))}
            </div>
            <div
              className='absolute right-3 top-3 z-20 flex items-center gap-2'
              dir='ltr'
            >
              <button
                type='button'
                aria-label={t('media.save')}
                disabled={saving}
                className='flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/80 active:scale-95 disabled:opacity-60'
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void saveMedia();
                }}
              >
                {saving ? (
                  <HeroIcon
                    className='h-5 w-5 animate-spin'
                    iconName='ArrowPathIcon'
                  />
                ) : (
                  <HeroIcon className='h-5 w-5' iconName='ArrowDownTrayIcon' />
                )}
              </button>
              {onClose && (
                <button
                  type='button'
                  aria-label={t('media.closePreview')}
                  onClick={onClose}
                  className='flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/80 active:scale-95'
                >
                  <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
                </button>
              )}
            </div>
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
            <div
              className='absolute right-3 top-3 z-20 flex items-center gap-2'
              dir='ltr'
            >
              <button
                type='button'
                aria-label={t('media.save')}
                disabled={saving}
                className='flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/80 active:scale-95 disabled:opacity-60'
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void saveMedia();
                }}
              >
                {saving ? (
                  <HeroIcon
                    className='h-5 w-5 animate-spin'
                    iconName='ArrowPathIcon'
                  />
                ) : (
                  <HeroIcon className='h-5 w-5' iconName='ArrowDownTrayIcon' />
                )}
              </button>
              {onClose && (
                <button
                  type='button'
                  aria-label={t('media.closePreview')}
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
