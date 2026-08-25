import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { uploadReel } from '@lib/firebase/utils';
import { withTimeout } from '@lib/utils';
import {
  formatFileSize,
  inferMediaType,
  MAX_VIDEO_UPLOAD_BYTES,
  uploadTimeoutMs
} from '@lib/media-limits';
import { getImagesData } from '@lib/validation';
import { useMentionAssist } from '@lib/hooks/useMentionAssist';
import { MentionSuggest } from '@components/input/mention-suggest';
import { Modal } from '@components/modal/modal';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';
import { useLanguage } from '@lib/context/language-context';

const modalVariants = {
  initial: { opacity: 0, scale: 0.94, y: 15 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', duration: 0.35, bounce: 0.1 }
  },
  exit: { opacity: 0, scale: 0.94, y: 15, transition: { duration: 0.2 } }
};

const SUGGESTED_TAGS = ['#ريلز', '#فيديو', '#ترند', '#ابداع', '#يوميات'];

type CreateReelModalProps = {
  open: boolean;
  closeModal: () => void;
};

export function CreateReelModal({
  open,
  closeModal
}: CreateReelModalProps): JSX.Element {
  const { t } = useLanguage();

  const { user } = useAuth();

  const [selectedVideos, setSelectedVideos] = useState<FilesWithId>([]);
  const [videoPreview, setVideoPreview] = useState<ImagesPreview>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [computingDuration, setComputingDuration] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const { mentionQuery, onMentionChange, insertMention, closeMentions } =
    useMentionAssist(caption, setCaption, captionRef);

  useEffect(() => {
    if (!open) {
      setSelectedVideos([]);
      setVideoPreview([]);
      setDurations({});
      setCaption('');
      setLoading(false);
      setUploadProgress(0);
      setComputingDuration(false);
      setIsDragging(false);
      closeMentions();
    }
  }, [open, closeMentions]);

  useEffect(() => {
    if (!selectedVideos.length) return;
    const revoked: string[] = [];
    const videoFile = selectedVideos[0];
    if (!videoFile) return;

    setComputingDuration(true);

    const compute = async (): Promise<void> => {
      const url = URL.createObjectURL(videoFile as File);
      revoked.push(url);
      const duration = await getMediaDuration(url);
      setDurations({ [videoFile.id]: duration });
      revoked.forEach((u) => URL.revokeObjectURL(u));
      setComputingDuration(false);
    };

    void compute();
    return () => {
      revoked.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [selectedVideos]);

  const handleFiles = (files: FileList | null): void => {
    if (!files || !files.length) return;
    const file = files[0];

    const mediaType = inferMediaType(file.name, file.type);
    if (!mediaType.startsWith('video/')) {
      toast.error(t('err.validVideo'));
      return;
    }

    if (file.size <= 0) {
      toast.error(t('err.emptyVideo'));
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      toast.error(
        `حجم الفيديو ${formatFileSize(
          file.size
        )}، والحد الأقصى ${formatFileSize(MAX_VIDEO_UPLOAD_BYTES)}`
      );
      return;
    }

    const imagesData = getImagesData(files, {
      allowUploadingVideos: true
    });

    if (!imagesData || !imagesData.selectedImagesData.length) {
      toast.error(t('err.processVideo'));
      return;
    }

    // Keep only the first video for a reel
    setVideoPreview([imagesData.imagesPreviewData[0]]);
    setSelectedVideos([imagesData.selectedImagesData[0]]);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    handleFiles(e.target.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeVideo = (): void => {
    setSelectedVideos([]);
    setVideoPreview([]);
    setDurations({});
    if (fileRef.current) fileRef.current.value = '';
  };

  const addTag = (tag: string): void => {
    if (caption.includes(tag)) return;
    setCaption((prev) => (prev ? `${prev.trim()} ${tag}` : tag));
  };

  const toggleVideoPlay = (): void => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => null);
      setIsPlayingPreview(true);
    } else {
      v.pause();
      setIsPlayingPreview(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!user || !selectedVideos.length) {
      toast.error(t('err.needVideoFirst'));
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    try {
      const file = selectedVideos[0];
      await withTimeout(
        uploadReel(
          user.id,
          selectedVideos,
          '#000000',
          caption,
          durations,
          null,
          setUploadProgress
        ),
        uploadTimeoutMs(file.size) + 30_000,
        t('err.videoTimeout')
      );
      toast.success(t('ok.reelPublished'));
      closeModal();
    } catch (error) {
      console.error('Failed to upload reel:', error);
      const msg =
        error instanceof Error
          ? error.message
          : t('err.reelPublish');
      toast.error(msg);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const currentDurationSec =
    selectedVideos[0] && durations[selectedVideos[0].id]
      ? Math.round(durations[selectedVideos[0].id] / 1000)
      : null;

  return (
    <Modal
      open={open}
      closeModal={closeModal}
      modalClassName='w-full max-w-lg overflow-hidden rounded-3xl bg-main-background p-0 shadow-2xl border border-light-border dark:border-dark-border'
    >
      <motion.div className='flex flex-col' {...modalVariants}>
        {/* Header */}
        <div className='flex items-center justify-between border-b border-light-border px-6 py-4 dark:border-dark-border'>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-main-accent/15 text-main-accent-text'>
              <HeroIcon className='h-5 w-5' iconName='FilmIcon' />
            </div>
            <div>
              <h2 className='text-lg font-bold leading-none text-light-primary dark:text-dark-primary'>
                {t('reels.createNew')}
              </h2>
              <p className='mt-1 text-xs text-light-secondary dark:text-dark-secondary'>
                {t('reels.createHint')}
              </p>
            </div>
          </div>
          <Button
            className='rounded-full p-2 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
            onClick={closeModal}
          >
            <HeroIcon
              className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
              iconName='XMarkIcon'
            />
          </Button>
        </div>

        {/* Content Body */}
        <div className='flex max-h-[75vh] flex-col gap-5 overflow-y-auto p-6'>
          {/* Video upload / preview */}
          {!videoPreview.length ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all ${
                isDragging
                  ? 'scale-[1.01] border-main-accent bg-main-accent/10'
                  : 'border-light-border hover:border-main-accent/60 hover:bg-main-accent/5 dark:border-dark-border'
              }`}
            >
              <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-main-accent/10 text-main-accent-text shadow-inner transition group-hover:scale-110'>
                <HeroIcon className='h-8 w-8' iconName='ArrowUpTrayIcon' />
              </div>
              <h3 className='text-base font-bold text-light-primary dark:text-dark-primary'>
                {t('reels.drop')}
              </h3>
              <p className='mt-1 text-sm text-light-secondary dark:text-dark-secondary'>
                {t('reels.browse')}
              </p>
              <div className='mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-light-secondary dark:text-dark-secondary'>
                <span className='rounded-full bg-light-line-reply/40 px-3 py-1 dark:bg-dark-line-reply/40'>
                  {t('reels.format')}
                </span>
                <span className='rounded-full bg-light-line-reply/40 px-3 py-1 dark:bg-dark-line-reply/40'>
                  {t('reels.vertical')}
                </span>
              </div>
              <input
                ref={fileRef}
                type='file'
                accept='video/mp4,video/quicktime,video/webm,video/m4v,video/*'
                className='hidden'
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className='relative overflow-hidden rounded-2xl bg-black'>
              {/* Video Player Preview */}
              <div className='relative flex aspect-[9/14] max-h-[340px] w-full items-center justify-center overflow-hidden bg-black'>
                <video
                  ref={videoRef}
                  src={videoPreview[0].src}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  onClick={toggleVideoPlay}
                  className='h-full w-full cursor-pointer object-cover'
                />

                {/* Overlays / Badges */}
                <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30' />

                {/* Duration Badge */}
                {currentDurationSec !== null && (
                  <div className='absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md'>
                    {computingDuration ? (
                      <span className='flex items-center gap-1'>
                        <HeroIcon
                          className='h-3 w-3 animate-spin'
                          iconName='ArrowPathIcon'
                        />
                        {t('reels.calculating')}
                      </span>
                    ) : (
                      `⏱ ${Math.floor(currentDurationSec / 60)}:${(
                        currentDurationSec % 60
                      )
                        .toString()
                        .padStart(2, '0')}`
                    )}
                  </div>
                )}

                {/* Sound Toggle */}
                <button
                  type='button'
                  onClick={() => setIsMuted((m) => !m)}
                  className='absolute bottom-3 left-3 rounded-full bg-black/60 p-2 text-white backdrop-blur-md transition hover:bg-black/80'
                >
                  <HeroIcon
                    className='h-4 w-4'
                    iconName={isMuted ? 'SpeakerXMarkIcon' : 'SpeakerWaveIcon'}
                  />
                </button>

                {/* Play/Pause indicator */}
                <button
                  type='button'
                  onClick={toggleVideoPlay}
                  className='absolute left-3 top-3 rounded-full bg-black/60 p-2 text-white backdrop-blur-md transition hover:bg-black/80'
                >
                  <HeroIcon
                    className='h-4 w-4'
                    iconName={isPlayingPreview ? 'PauseIcon' : 'PlayIcon'}
                  />
                </button>

                {/* Replace / Remove Video */}
                <button
                  type='button'
                  onClick={removeVideo}
                  className='absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md transition hover:bg-red-700'
                >
                  <HeroIcon className='h-3.5 w-3.5' iconName='TrashIcon' />
                  <span>{t('reels.deleteVideo')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Caption & Tags Section */}
          <div className='relative flex flex-col gap-2'>
            <MentionSuggest
              query={mentionQuery}
              onSelect={insertMention}
              onClose={closeMentions}
            />
            <div className='flex items-center justify-between'>
              <label className='text-sm font-bold text-light-primary dark:text-dark-primary'>
                {t('reels.caption')}
              </label>
              <span
                className={`text-xs ${
                  caption.length > 260
                    ? 'font-bold text-accent-red'
                    : 'text-light-secondary dark:text-dark-secondary'
                }`}
              >
                {caption.length} / 280
              </span>
            </div>

            <textarea
              ref={captionRef}
              value={caption}
              onChange={onMentionChange}
              placeholder={t('media.reelDesc')}
              rows={3}
              maxLength={280}
              dir='auto'
              className='user-text w-full resize-none rounded-2xl border border-light-border bg-light-line-reply/20 p-3.5 text-sm text-light-primary outline-none transition placeholder:text-light-secondary/60 focus:border-main-accent focus:ring-1 focus:ring-main-accent dark:border-dark-border dark:bg-dark-line-reply/20 dark:text-dark-primary dark:placeholder:text-dark-secondary/60'
            />

            {/* Quick Hashtags */}
            <div className='flex flex-wrap items-center gap-1.5 pt-1'>
              <span className='text-xs text-light-secondary dark:text-dark-secondary'>
                {t('reels.suggestedTags')}
              </span>
              {SUGGESTED_TAGS.map((tag) => (
                <button
                  key={tag}
                  type='button'
                  onClick={() => addTag(tag)}
                  className='rounded-full bg-light-line-reply/40 px-2.5 py-0.5 text-xs text-light-secondary transition hover:bg-main-accent/15 hover:text-main-accent-text dark:bg-dark-line-reply/40 dark:text-dark-secondary'
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className='flex items-center justify-end gap-3 border-t border-light-border p-4 px-6 dark:border-dark-border'>
          <Button
            type='button'
            className='px-4 py-2 text-sm text-light-secondary hover:bg-light-primary/5 dark:text-dark-secondary dark:hover:bg-dark-primary/5'
            onClick={closeModal}
          >
            {loading ? t('common.close') : t('common.cancel')}
          </Button>

          <Button
            type='button'
            className='flex items-center gap-2 rounded-full bg-main-accent px-6 py-2.5 font-bold text-main-accent-contrast shadow-lg transition hover:brightness-95 active:scale-95 disabled:pointer-events-none disabled:opacity-50'
            onClick={handleSubmit}
            loading={loading || computingDuration}
            disabled={!selectedVideos.length || loading || computingDuration}
          >
            <HeroIcon className='h-5 w-5' iconName='PaperAirplaneIcon' />
            <span>
              {loading
                ? uploadProgress > 0
                  ? t('media.uploading', { n: uploadProgress })
                  : t('media.preparing')
                : t('media.publishReel')}
            </span>
          </Button>
        </div>
      </motion.div>
    </Modal>
  );
}

function getMediaDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const timeout = window.setTimeout(() => finish(15_000), 8_000);
    const cleanup = (): void => {
      window.clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
    };
    const finish = (duration: number): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(duration);
    };

    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      finish(
        duration && isFinite(duration) ? Math.round(duration * 1000) : 15_000
      );
    };
    video.onerror = () => finish(15_000);
    video.src = url;
  });
}
