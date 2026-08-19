import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { uploadStory } from '@lib/firebase/utils';
import { getImagesData } from '@lib/validation';
import { Modal } from '@components/modal/modal';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { MusicSearch } from './music-search';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';

const STORY_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
  '#f43f5e',
  '#000000',
  '#ffffff'
];

const modalVariants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: { type: 'spring', duration: 0.4 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

type CreateStoryModalProps = {
  open: boolean;
  closeModal: () => void;
};

export function CreateStoryModal({
  open,
  closeModal
}: CreateStoryModalProps): JSX.Element {
  const { user } = useAuth();

  const [selectedImages, setSelectedImages] = useState<FilesWithId>([]);
  const [imagesPreview, setImagesPreview] = useState<ImagesPreview>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [caption, setCaption] = useState('');
  const [color, setColor] = useState(STORY_COLORS[6]);
  const [music, setMusic] = useState<{ src: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [computingDurations, setComputingDurations] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const defaultColor = user?.storyColor ?? STORY_COLORS[6];
    if (!open) {
      setSelectedImages([]);
      setImagesPreview([]);
      setDurations({});
      setCaption('');
      setColor(defaultColor);
      setMusic(null);
      setLoading(false);
      setComputingDurations(false);
    } else setColor(defaultColor);
  }, [open, user?.storyColor]);

  useEffect(() => {
    if (!selectedImages.length) return;
    const revoked: string[] = [];
    const hasVideo = selectedImages.some((f) => f.type.startsWith('video/'));
    if (hasVideo) setComputingDurations(true);

    const compute = async (): Promise<void> => {
      const newDurations: Record<string, number> = {};
      await Promise.all(
        selectedImages.map(async (file) => {
          if (!file.type.startsWith('video/')) return;
          const url = URL.createObjectURL(file as File);
          revoked.push(url);
          const duration = await getMediaDuration(url, file.type);
          newDurations[file.id] = duration;
        })
      );
      setDurations((prev) => ({ ...prev, ...newDurations }));
      revoked.forEach((url) => URL.revokeObjectURL(url));
      setComputingDurations(false);
    };

    void compute();
    return () => {
      revoked.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedImages]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const imagesData = getImagesData(e.target.files, {
      allowUploadingVideos: true
    });
    if (!imagesData) {
      toast.error('يرجى اختيار صورة أو فيديو واحد كحد أقصى 4');
      return;
    }
    setImagesPreview(imagesData.imagesPreviewData);
    setSelectedImages(imagesData.selectedImagesData);
  };

  const removeImage = (targetId: string) => (): void => {
    setImagesPreview((prev) => prev.filter(({ id }) => id !== targetId));
    setSelectedImages((prev) => prev.filter(({ id }) => id !== targetId));
    setDurations((prev) => {
      const { [targetId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = async (): Promise<void> => {
    if (!user || !selectedImages.length) return;

    setLoading(true);
    try {
      await uploadStory(
        user.id,
        selectedImages,
        color,
        caption,
        durations,
        music
      );
      toast.success('تم نشر القصة');
      closeModal();
    } catch {
      toast.error('فشل نشر القصة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      closeModal={closeModal}
      modalClassName='w-full max-w-md overflow-hidden rounded-2xl bg-main-background p-0'
    >
      <motion.div className='flex flex-col gap-4 p-6' {...modalVariants}>
        <h2 className='text-xl font-bold'>إنشاء قصة</h2>

        <div>
          <p className='mb-2 text-sm text-light-secondary dark:text-dark-secondary'>
            لون الحلقة
          </p>
          <div className='flex flex-wrap gap-2'>
            {STORY_COLORS.map((c) => (
              <button
                key={c}
                type='button'
                onClick={(): void => setColor(c)}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition',
                  color === c ? 'scale-110 border-white' : 'border-transparent'
                )}
                style={{ backgroundColor: c }}
                aria-label={`اختيار اللون ${c}`}
              />
            ))}
          </div>
        </div>

        <input
          type='text'
          value={caption}
          onChange={(e): void => setCaption(e.target.value)}
          placeholder='تعليق (اختياري)'
          className='w-full rounded-xl bg-light-line-reply/30 p-3 text-light-primary
                     outline-none dark:bg-dark-line-reply/30 dark:text-dark-primary'
        />

        <MusicSearch selected={music} onSelect={setMusic} />

        <button
          type='button'
          onClick={(): void => fileRef.current?.click()}
          className='relative flex w-full items-center justify-center gap-2 rounded-xl border-2
                     border-dashed border-light-border py-6 text-light-secondary
                     transition hover:bg-light-primary/5 dark:border-dark-border
                     dark:text-dark-secondary dark:hover:bg-dark-primary/5'
        >
          {computingDurations && (
            <span className='absolute left-3 top-3'>
              <HeroIcon className='h-5 w-5 animate-spin' iconName='ArrowPathIcon' />
            </span>
          )}
          <HeroIcon className='h-6 w-6' iconName='PhotoIcon' />
          <span>اختر صورة أو فيديو أو أكثر</span>
          <input
            ref={fileRef}
            type='file'
            accept='image/*,video/*'
            multiple
            className='hidden'
            onChange={handleFileChange}
          />
        </button>

        {!!imagesPreview.length && (
          <div className='flex gap-2 overflow-x-auto py-2'>
            {imagesPreview.map(({ id, src, alt, type }) => (
              <div key={id} className='relative shrink-0'>
                {type?.startsWith('video/') ? (
                  <video src={src} className='h-24 w-16 rounded-lg object-cover' />
                ) : (
                  <img
                    src={src}
                    alt={alt}
                    className='h-24 w-16 rounded-lg object-cover'
                  />
                )}
                <button
                  type='button'
                  onClick={removeImage(id)}
                  className='absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center
                             rounded-full bg-black/70 text-white'
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <Button
          type='button'
          className='bg-main-accent px-4 py-2 font-bold text-black disabled:opacity-50'
          onClick={handleSubmit}
          loading={loading || computingDurations}
          disabled={!selectedImages.length || loading || computingDurations}
        >
          نشر القصة
        </Button>
      </motion.div>
    </Modal>
  );
}

function getMediaDuration(url: string, type: string): Promise<number> {
  return new Promise((resolve) => {
    if (!type.startsWith('video/')) return resolve(15000);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = url;
    const cleanup = (): void => {
      video.onloadedmetadata = null;
      video.onerror = null;
    };
    video.onloadedmetadata = () => {
      cleanup();
      const duration = video.duration;
      resolve(duration && isFinite(duration) ? Math.round(duration * 1000) : 15000);
    };
    video.onerror = () => {
      cleanup();
      resolve(15000);
    };
  });
}
