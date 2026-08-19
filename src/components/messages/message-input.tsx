import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type ChangeEvent,
  type PointerEvent
} from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { sendMessage, uploadImages } from '@lib/firebase/utils';
import { getImagesData } from '@lib/validation';
import { getRandomId } from '@lib/random';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';
import type { ReplyTo } from '@lib/types/message';

type MessageInputProps = {
  conversationId: string;
  receiverId: string;
  replyTo?: ReplyTo | null;
  onClearReply?: () => void;
};

function VoiceRecorder({
  recording,
  seconds
}: {
  recording: boolean;
  seconds: number;
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className='absolute inset-x-0 bottom-full mb-2 flex items-center justify-center gap-2
                 rounded-2xl border border-red-400/30 bg-gradient-to-r from-red-500/20 
                 to-pink-500/10 px-4 py-3 shadow-lg backdrop-blur-xl'
    >
      <span className='mr-2 flex items-center gap-1.5 text-sm font-semibold text-red-400'>
        <span className='h-2 w-2 animate-pulse rounded-full bg-red-500' />
        {seconds}s
      </span>
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          animate={
            recording
              ? {
                  height: [8, 14 + (i % 6) * 5, 8],
                  opacity: [0.5, 1, 0.5]
                }
              : { height: 8, opacity: 0.5 }
          }
          transition={{
            duration: 0.5 + (i % 4) * 0.1,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className='w-1 rounded-full bg-gradient-to-t from-red-500 to-pink-400'
        />
      ))}
    </motion.div>
  );
}

export function MessageInput({
  conversationId,
  receiverId,
  replyTo,
  onClearReply
}: MessageInputProps): JSX.Element {
  const { user } = useAuth();

  const [text, setText] = useState('');
  const [selectedImages, setSelectedImages] = useState<FilesWithId>([]);
  const [imagesPreview, setImagesPreview] = useState<ImagesPreview>([]);
  const [loading, setLoading] = useState(false);
  const [replySnippet, setReplySnippet] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startingRef = useRef(false);
  const stopDuringStartRef = useRef(false);
  const cancelledRef = useRef(false);
  const mimeTypeRef = useRef<string>('');

  useEffect(() => {
    if (replyTo?.text) setReplySnippet(replyTo.text);
    else if (replyTo) setReplySnippet('صوت / صورة');
  }, [replyTo]);

  const finishRecording = (cancel: boolean): void => {
    cancelledRef.current = cancel;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // noop
      }
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanupRecording = (): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    stopDuringStartRef.current = false;
    cancelledRef.current = false;
    setRecording(false);
    setRecordingSeconds(0);
  };

  const startRecording = async (): Promise<void> => {
    if (!user?.id || recorderRef.current || startingRef.current) return;

    if (typeof MediaRecorder === 'undefined') {
      toast.error('المتصفح لا يدعم التسجيل الصوتي');
      return;
    }

    startingRef.current = true;
    cancelledRef.current = false;
    stopDuringStartRef.current = false;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (stopDuringStartRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        startingRef.current = false;
        stopDuringStartRef.current = false;
        return;
      }

      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      mimeTypeRef.current = mimeType || 'audio/webm';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e): void => {
        if (e.data.size) chunksRef.current.push(e.data);
      };

      recorder.onerror = (): void => {
        toast.error('خطأ أثناء التسجيل');
        cleanupRecording();
      };

      recorder.onstop = async (): Promise<void> => {
        const blobType = mimeTypeRef.current;
        const recordedMs = Date.now() - startTimeRef.current;
        const chunks = chunksRef.current.splice(0);
        const wasCancelled = cancelledRef.current;

        cleanupRecording();

        if (wasCancelled || !chunks.length || recordedMs < 500) return;

        const blob = new Blob(chunks, { type: blobType });
        if (!blob.size) return;

        const durationSec = Math.max(1, Math.round(recordedMs / 1000));
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: blobType
        }) as FilesWithId[number];
        (file as { id: string }).id = getRandomId();

        setLoading(true);
        try {
          const uploaded = await uploadImages(user.id, [file]);
          const audioUrl = uploaded?.[0]?.src;
          if (!audioUrl) throw new Error('no audio url');

          await sendMessage(
            conversationId,
            user.id,
            receiverId,
            null,
            null,
            replyTo ?? null,
            { src: audioUrl, duration: durationSec }
          );
          onClearReply?.();
        } catch {
          toast.error('فشل إرسال التسجيل الصوتي');
        } finally {
          setLoading(false);
        }
      };

      recorder.start();
      startTimeRef.current = Date.now();
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast.error('لا يمكن الوصول للميكروفون');
      cleanupRecording();
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecording = (): void => {
    if (recorderRef.current) {
      finishRecording(false);
    } else if (startingRef.current) {
      stopDuringStartRef.current = true;
    }
  };

  const cancelRecording = (): void => {
    if (recorderRef.current) {
      finishRecording(true);
    } else if (startingRef.current) {
      stopDuringStartRef.current = true;
    }
  };

  const startHandler = (): void => {
    void startRecording();
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>): void => {
    const imagesData = getImagesData(e.target.files, {
      currentFiles: imagesPreview.length,
      allowUploadingVideos: false
    });

    if (!imagesData) {
      toast.error('يرجى اختيار حتى 4 صور');
      return;
    }

    const { imagesPreviewData, selectedImagesData } = imagesData;

    setImagesPreview((prev) => [...prev, ...imagesPreviewData]);
    setSelectedImages((prev) => [...prev, ...selectedImagesData]);
  };

  const removeImage = (targetId: string): void => {
    setSelectedImages((prev) => prev.filter(({ id }) => id !== targetId));
    setImagesPreview((prev) => prev.filter(({ id }) => id !== targetId));
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    if (!user?.id) return;

    const trimmedText = text.trim();
    if (!trimmedText && !selectedImages.length) return;

    setLoading(true);

    try {
      const images = selectedImages.length
        ? await uploadImages(user.id, selectedImages)
        : null;

      await sendMessage(
        conversationId,
        user.id,
        receiverId,
        trimmedText || null,
        images,
        replyTo ?? null
      );

      setText('');
      setSelectedImages([]);
      setImagesPreview([]);
      setReplySnippet(null);
      onClearReply?.();
      inputRef.current?.focus();
    } catch {
      toast.error('فشل إرسال الرسالة');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!text.trim() || !!selectedImages.length;

  const micButtonClasses = recording
    ? 'bg-red-500/20 text-red-500'
    : 'text-red-500 hover:bg-red-500/10';

  return (
    <form
      onSubmit={handleSubmit}
      className='relative border-t border-light-border px-4 py-3 dark:border-dark-border'
    >
      {recording && <VoiceRecorder recording={recording} seconds={recordingSeconds} />}

      {replyTo && replySnippet && (
        <div
          className='mb-2 flex items-center justify-between rounded-lg border-l-4 border-main-accent 
                     bg-white/10 px-3 py-2 text-xs text-white/80 backdrop-blur-sm'
        >
          <div className='min-w-0'>
            <p className='truncate font-medium'>رد على:</p>
            <p className='truncate opacity-80'>{replySnippet}</p>
          </div>
          <button
            type='button'
            onClick={onClearReply}
            className='p-1 text-white/70 transition hover:text-white'
          >
            <HeroIcon iconName='XMarkIcon' className='h-4 w-4' />
          </button>
        </div>
      )}

      {imagesPreview.length > 0 && (
        <div className='mb-2 flex flex-wrap gap-2'>
          {imagesPreview.map((image) => (
            <div key={image.id} className='relative'>
              <img
                src={image.src}
                alt={image.alt}
                className='h-20 w-20 rounded-lg object-cover'
              />
              <button
                type='button'
                onClick={(): void => removeImage(image.id)}
                className='absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center 
                           rounded-full bg-black text-xs text-white'
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div className='flex items-end gap-2'>
        <textarea
          ref={inputRef}
          value={text}
          onKeyDown={(e): void => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          onChange={({
            target: { value }
          }: ChangeEvent<HTMLTextAreaElement>): void => setText(value)}
          placeholder='اكتب رسالة...'
          rows={1}
          className='min-h-[48px] flex-1 resize-none rounded-xl bg-light-primary/10 
                     p-3 text-base outline-none dark:bg-dark-primary/10'
        />
        <label
          className='cursor-pointer rounded-full p-2 transition hover:bg-light-primary/10 
                     dark:hover:bg-dark-primary/10'
        >
          <HeroIcon iconName='PhotoIcon' className='h-5 w-5 text-main-accent' />
          <input
            type='file'
            accept='image/*'
            multiple
            className='hidden'
            onChange={handleImageUpload}
          />
        </label>
        <button
          type='button'
          disabled={loading}
          onPointerDown={(e: PointerEvent<HTMLButtonElement>): void => {
            e.preventDefault();
            startHandler();
          }}
          onPointerUp={stopRecording}
          onPointerLeave={cancelRecording}
          onPointerCancel={cancelRecording}
          className={`touch-none rounded-full p-2 transition ${micButtonClasses}`}
        >
          <HeroIcon iconName='MicrophoneIcon' className='h-5 w-5' />
        </button>
        <Button
          type='submit'
          className='bg-main-accent px-4 py-2 text-black hover:brightness-90 
                     active:brightness-75 disabled:opacity-50'
          loading={loading}
          disabled={!canSubmit}
        >
          <HeroIcon iconName='PaperAirplaneIcon' className='h-5 w-5' />
        </Button>
      </div>
    </form>
  );
}
