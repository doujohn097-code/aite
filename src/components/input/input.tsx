import Link from 'next/link';
import { useState, useEffect, useRef, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { serverTimestamp } from 'firebase/firestore';
import {
  manageReply,
  uploadImages,
  createTweet
} from '@lib/firebase/utils';
import { useAuth } from '@lib/context/auth-context';

import { getImagesData } from '@lib/validation';
import { getAudioWaveform } from '@lib/audio';
import { notifyMentions } from '@lib/mentions';
import { formatFileSize, MAX_AUDIO_UPLOAD_BYTES } from '@lib/media-limits';
import { UserAvatar } from '@components/user/user-avatar';
import { InputForm, fromTop } from './input-form';
import { ImagePreview } from './image-preview';
import { InputOptions } from './input-options';
import { VoicePlayer } from '@components/messages/voice-player';
import { VoiceRecorder } from '@components/messages/voice-recorder';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import type { ReactNode, FormEvent, ChangeEvent, ClipboardEvent } from 'react';
import type { WithFieldValue } from 'firebase/firestore';
import type { Variants } from 'framer-motion';
import type { User } from '@lib/types/user';
import type { Tweet } from '@lib/types/tweet';
import type { FilesWithId, ImagesPreview, ImageData } from '@lib/types/file';

type InputProps = {
  modal?: boolean;
  reply?: boolean;
  parent?: { id: string; username: string };
  disabled?: boolean;
  children?: ReactNode;
  replyModal?: boolean;
  closeModal?: () => void;
};

export const variants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 }
};

export function Input({
  modal,
  reply,
  parent,
  disabled,
  children,
  replyModal,
  closeModal
}: InputProps): JSX.Element {
  const [selectedImages, setSelectedImages] = useState<FilesWithId>([]);
  const [imagesPreview, setImagesPreview] = useState<ImagesPreview>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [visited, setVisited] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMeta, setAudioMeta] = useState<{
    duration: number;
    peaks: number[];
  } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { user, isAdmin } = useAuth();
  const { name, username, photoURL } = user as User;

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const previewCount = imagesPreview.length;
  const isUploadingImages = !!previewCount;

  useEffect(
    () => {
      if (modal) inputRef.current?.focus();
      return cleanImage;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sendTweet = async (): Promise<void> => {
    inputRef.current?.blur();

    setLoading(true);
    setUploadProgress(0);

    try {
      const isReplying = reply ?? replyModal;

      const userId = user?.id as string;

      // نسبة مئوية إجمالية عبر كل الرفعات (صوت + صور)
      const uploadCount = (audioBlob ? 1 : 0) + (selectedImages.length ? 1 : 0);
      const progressByKey: Record<string, number> = {};
      const trackProgress =
        (key: string) =>
        (percent: number): void => {
          progressByKey[key] = percent;
          const sum = Object.values(progressByKey).reduce((a, b) => a + b, 0);
          setUploadProgress(Math.min(Math.round(sum / uploadCount), 99));
        };

      let audio: Tweet['audio'] = null;
      if (audioBlob && audioMeta) {
        const audioFile = new File(
          [audioBlob],
          `voice-${Math.random().toString(36).slice(2)}.webm`,
          { type: audioBlob.type || 'audio/webm' }
        );
        const [uploadedAudio] =
          (await uploadImages(
            userId,
            [Object.assign(audioFile, { id: `audio-${Date.now()}` })],
            trackProgress('audio')
          )) ?? [];
        if (uploadedAudio)
          audio = {
            src: uploadedAudio.src,
            duration: Math.round(audioMeta.duration),
            peaks: audioMeta.peaks
          };
      }

      const tweetData: WithFieldValue<Omit<Tweet, 'id'>> = {
        text: inputValue.trim() || null,
        parent: isReplying && parent ? parent : null,
        images: await uploadImages(
          userId,
          selectedImages,
          trackProgress('images')
        ),
        audio,
        userLikes: [],
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: null,
        userReplies: 0,
        userRetweets: []
      };

      const tweetId = await createTweet(userId, tweetData, {
        isReply: !!isReplying
      });
      await Promise.all([
        isReplying &&
          manageReply('increment', parent?.id as string, tweetId),
        notifyMentions('post', tweetId)
      ]);

      if (!modal && !replyModal) discardTweet();

      if (closeModal) closeModal();

      toast.success(
        () => (
          <span className='flex gap-2'>
            تم نشر منشورك
            <Link href={`/tweet/${tweetId}`}>
              <a className='custom-underline font-bold'>عرض</a>
            </Link>
          </span>
        ),
        { duration: 6000 }
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : 'فشل نشر المنشور. حاول مجددًا.'
      );
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleImageUpload = (
    e: ChangeEvent<HTMLInputElement> | ClipboardEvent<HTMLTextAreaElement>
  ): void => {
    const isClipboardEvent = 'clipboardData' in e;

    if (isClipboardEvent) {
      const isPastingText = e.clipboardData.getData('text');
      if (isPastingText) return;
    }

    const files = isClipboardEvent ? e.clipboardData.files : e.target.files;

    // ملف صوتي مفرد → يُعامل كمنشور صوتي مموّج
    const audioFile =
      files && files.length === 1 && files[0].type.startsWith('audio/')
        ? files[0]
        : null;
    if (audioFile) {
      if (audioFile.size > MAX_AUDIO_UPLOAD_BYTES) {
        toast.error(
          `حجم الملف الصوتي ${formatFileSize(
            audioFile.size
          )} ويتجاوز الحد الأقصى ${formatFileSize(MAX_AUDIO_UPLOAD_BYTES)}`
        );
        if (!isClipboardEvent && e.target) e.target.value = '';
        return;
      }
      void (async (): Promise<void> => {
        const meta = await getAudioWaveform(audioFile);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioBlob(audioFile);
        setAudioMeta(meta);
        setAudioUrl(URL.createObjectURL(audioFile));
      })();
      if (!isClipboardEvent && e.target) e.target.value = '';
      return;
    }

    const imagesData = getImagesData(files, {
      currentFiles: previewCount,
      allowUploadingVideos: true
    });

    if (!imagesData) {
      toast.error('يرجى اختيار صورة واحدة كحد أقصى 4');
      return;
    }

    const { imagesPreviewData, selectedImagesData } = imagesData;

    setImagesPreview([...imagesPreview, ...imagesPreviewData]);
    setSelectedImages([...selectedImages, ...selectedImagesData]);

    inputRef.current?.focus();
  };

  const removeImage = (targetId: string) => (): void => {
    setSelectedImages(selectedImages.filter(({ id }) => id !== targetId));
    setImagesPreview(imagesPreview.filter(({ id }) => id !== targetId));

    const { src } = imagesPreview.find(
      ({ id }) => id === targetId
    ) as ImageData;

    URL.revokeObjectURL(src);
  };

  const cleanImage = (): void => {
    imagesPreview.forEach(({ src }) => URL.revokeObjectURL(src));

    setSelectedImages([]);
    setImagesPreview([]);
  };

  const discardTweet = (): void => {
    setInputValue('');
    setVisited(false);
    cleanImage();
    discardAudio();

    inputRef.current?.blur();
  };

  const discardAudio = (): void => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioMeta(null);
    setAudioUrl(null);
    setRecording(false);
  };

  const handleRecordComplete = (
    blob: Blob,
    duration: number,
    peaks: number[]
  ): void => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(blob);
    setAudioMeta({ duration, peaks });
    setAudioUrl(URL.createObjectURL(blob));
    setRecording(false);
  };

  const handleChange = ({
    target: { value }
  }: ChangeEvent<HTMLTextAreaElement>): void => setInputValue(value);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void sendTweet();
  };

  const handleFocus = (): void => setVisited(!loading);

  const formId = useId();

  const inputLimit = isAdmin ? 560 : 280;

  const inputLength = inputValue.length;
  const isValidInput = !!inputValue.trim().length;
  const isCharLimitExceeded = inputLength > inputLimit;

  const isValidTweet =
    !isCharLimitExceeded &&
    (isValidInput || isUploadingImages || !!(audioBlob && audioMeta));

  return (
    <form
      className={cn('flex flex-col', {
        '-mx-4': reply,
        'gap-2': replyModal,
        'cursor-not-allowed': disabled
      })}
      onSubmit={handleSubmit}
    >
      {loading && (
        <motion.i
          className='h-1 animate-pulse bg-light-primary dark:bg-white'
          {...variants}
        />
      )}
      {children}
      {reply && visited && (
        <motion.p
          className='-mb-2 ml-[75px] mt-2 text-light-secondary dark:text-dark-secondary'
          {...fromTop}
        >
          رد على{' '}
          <Link href={`/user/${parent?.username as string}`}>
            <a className='custom-underline text-main-accent-text'>
              {parent?.username as string}
            </a>
          </Link>
        </motion.p>
      )}
      <label
        className={cn(
          'hover-animation grid w-full grid-cols-[auto,1fr] gap-3 px-4 py-3',
          reply
            ? 'pb-1 pt-3'
            : replyModal
            ? 'pt-0'
            : 'border-b-2 border-light-border dark:border-dark-border',
          (disabled || loading) && 'pointer-events-none opacity-50'
        )}
        htmlFor={formId}
      >
        <UserAvatar
          src={photoURL ?? '/assets/default-avatar.png'}
          alt={name ?? 'المستخدم'}
          username={username ?? ''}
        />
        <div className='flex w-full flex-col gap-4'>
          <InputForm
            modal={modal}
            reply={reply}
            formId={formId}
            visited={visited}
            loading={loading}
            inputRef={inputRef}
            replyModal={replyModal}
            inputValue={inputValue}
            isValidTweet={isValidTweet}
            isUploadingImages={isUploadingImages}
            sendTweet={sendTweet}
            handleFocus={handleFocus}
            discardTweet={discardTweet}
            handleChange={handleChange}
            handleImageUpload={handleImageUpload}
          >
            {isUploadingImages && (
              <ImagePreview
                imagesPreview={imagesPreview}
                previewCount={previewCount}
                removeImage={!loading ? removeImage : undefined}
              />
            )}
            {recording && (
              <div
                className='rounded-2xl border border-light-border p-2 dark:border-dark-border'
                onClick={(e) => e.preventDefault()}
              >
                <VoiceRecorder
                  onComplete={handleRecordComplete}
                  onCancel={(): void => setRecording(false)}
                />
              </div>
            )}
            {!recording && audioUrl && audioMeta && (
              <div
                className='relative flex items-center gap-2 rounded-2xl border border-light-border
                           bg-light-primary/5 p-3 dark:border-dark-border dark:bg-dark-primary/5'
                onClick={(e) => e.preventDefault()}
              >
                <div className='min-w-0 flex-1'>
                  <VoicePlayer
                    src={audioUrl}
                    duration={audioMeta.duration}
                    peaks={audioMeta.peaks}
                  />
                </div>
                {!loading && (
                  <Button
                    className='shrink-0 rounded-full p-1.5 text-light-secondary
                               hover:bg-light-primary/10 dark:text-dark-secondary'
                    onClick={discardAudio}
                  >
                    <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
                  </Button>
                )}
              </div>
            )}
            {loading && uploadProgress > 0 && (
              <div className='flex flex-col gap-1.5 px-1'>
                <div className='flex items-center justify-between text-xs text-light-secondary dark:text-dark-secondary'>
                  <span>جارٍ الرفع…</span>
                  <span className='tabular-nums'>{uploadProgress}%</span>
                </div>
                <div className='h-1.5 w-full overflow-hidden rounded-full bg-light-border dark:bg-dark-border'>
                  <div
                    className='h-full rounded-full bg-accent-blue transition-all duration-300'
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </InputForm>
          <AnimatePresence initial={false}>
            {(reply ? reply && visited && !loading : !loading) && (
              <InputOptions
                reply={reply}
                modal={modal}
                loading={loading}
                inputLimit={inputLimit}
                inputLength={inputLength}
                isValidTweet={isValidTweet}
                isCharLimitExceeded={isCharLimitExceeded}
                onRecordVoice={(): void => setRecording(true)}
                handleImageUpload={handleImageUpload}
              />
            )}
          </AnimatePresence>
        </div>
      </label>
    </form>
  );
}
