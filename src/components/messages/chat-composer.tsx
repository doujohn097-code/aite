import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import cn from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { HeroIcon } from '@components/ui/hero-icon';
import { useMentionAssist } from '@lib/hooks/useMentionAssist';
import { MentionSuggest } from '@components/input/mention-suggest';
import { VoiceRecorder } from './voice-recorder';
import { VoicePlayer } from './voice-player';
import { getRandomId } from '@lib/random';
import type { FilesWithId } from '@lib/types/file';
import type { MessageType } from '@lib/types/message';

type VoiceDraft = {
  url: string;
  blob: Blob;
  duration: number;
  peaks: number[];
};

type ChatComposerProps = {
  sending?: boolean;
  replyingTo?: {
    senderName: string;
    text: string | null;
    type: MessageType;
  } | null;
  onCancelReply?: () => void;
  /** نص الرسالة قيد التعديل (null = لا يوجد تعديل) */
  editingText?: string | null;
  onCancelEdit?: () => void;
  onSubmitEdit?: (text: string) => void;
  onSendText: (text: string) => void;
  onSendMedia: (files: FilesWithId, kind: 'image' | 'video') => void;
  onSendVoice: (
    blob: Blob,
    duration: number,
    peaks: number[]
  ) => Promise<boolean>;
  onTyping?: (typing: boolean) => void;
};

export function ChatComposer({
  sending,
  replyingTo,
  onCancelReply,
  editingText,
  onCancelEdit,
  onSubmitEdit,
  onSendText,
  onSendMedia,
  onSendVoice,
  onTyping
}: ChatComposerProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState('');
  const { mentionQuery, onMentionChange, insertMention, closeMentions } =
    useMentionAssist(text, setText, textInputRef);
  const isEditing = editingText !== null && editingText !== undefined;
  const [files, setFiles] = useState<FilesWithId>([]);
  const [previews, setPreviews] = useState<
    { id: string; url: string; type: string }[]
  >([]);
  const [voice, setVoice] = useState<VoiceDraft | null>(null);
  const [recording, setRecording] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingSent = useRef(false);

  useEffect(() => {
    if (editingText !== null && editingText !== undefined) setText(editingText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingText]);

  const notifyTyping = (): void => {
    if (!onTyping) return;
    if (!isTypingSent.current) {
      isTypingSent.current = true;
      onTyping(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingSent.current = false;
      onTyping(false);
    }, 2500);
  };

  const stopTyping = (): void => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (isTypingSent.current) {
      isTypingSent.current = false;
      onTyping?.(false);
    }
  };

  const hasContent = text.trim().length > 0 || files.length > 0 || !!voice;

  const addFiles = (list: FileList | null): void => {
    if (!list) return;
    const accepted = Array.from(list)
      .filter(
        (file) =>
          file.type.startsWith('image/') || file.type.startsWith('video/')
      )
      .slice(0, 4 - files.length);

    if (!accepted.length) return;

    const withIds = accepted.map((file) =>
      Object.assign(file, { id: getRandomId() })
    ) as FilesWithId;

    setFiles((prev) => [...prev, ...withIds]);
    setPreviews((prev) => [
      ...prev,
      ...withIds.map((file) => ({
        id: file.id,
        url: URL.createObjectURL(file),
        type: file.type
      }))
    ]);
  };

  const removeFile = (id: string): void => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
    setPreviews((prev) => {
      const removed = prev.find((preview) => preview.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((preview) => preview.id !== id);
    });
  };

  const handleSend = async (): Promise<void> => {
    // وضع التعديل: نحفظ النص الجديد بدل إرسال رسالة جديدة
    if (isEditing) {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      onSubmitEdit?.(trimmed);
      setText('');
      stopTyping();
      return;
    }

    if (!hasContent || sending) return;

    // A composer action must create exactly one message. Previously a draft
    // containing text + media/voice could dispatch several messages at once.
    // Keep the text in the editor when an attachment is sent, so it is never
    // silently lost and can be sent as the following message/caption.
    if (files.length) {
      const kind = files.some((file) => file.type.startsWith('video/'))
        ? 'video'
        : 'image';
      onSendMedia(files, kind);
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
      setFiles([]);
      setPreviews([]);
    } else if (voice) {
      const sent = await onSendVoice(voice.blob, voice.duration, voice.peaks);
      if (sent) {
        URL.revokeObjectURL(voice.url);
        setVoice(null);
      }
    } else {
      onSendText(text.trim());
      setText('');
    }
    stopTyping();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className='bg-main-background px-2 pb-2 pt-2'>
      <div aria-live='polite' className='sr-only'>
        {sending ? 'جارٍ إرسال الرسالة' : ''}
      </div>
      {/* شريط التعديل */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className='overflow-hidden'
          >
            <div
              className='relative mb-2 flex items-center gap-2 overflow-hidden rounded-2xl
                         border border-main-accent/30 bg-main-accent/10 px-3 py-2 ps-5'
            >
              <span className='absolute inset-y-0 start-0 w-1 rounded-full bg-gradient-to-b from-main-accent to-main-accent/30' />
              <HeroIcon
                className='h-4 w-4 shrink-0 text-main-accent-text'
                iconName='PencilSquareIcon'
              />
              <div className='flex min-w-0 flex-1 flex-col text-xs'>
                <span className='font-bold text-main-accent-text'>
                  تعديل الرسالة
                </span>
                <span className='truncate text-light-secondary dark:text-dark-secondary'>
                  {editingText || ''}
                </span>
              </div>
              <button
                type='button'
                onClick={(): void => {
                  setText('');
                  onCancelEdit?.();
                }}
                aria-label='إلغاء التعديل'
                className='shrink-0 rounded-full p-1.5 text-light-secondary transition
                           hover:bg-light-primary/10 dark:text-dark-secondary'
              >
                <HeroIcon className='h-4 w-4' iconName='XMarkIcon' />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* شريط الرد قبل الإرسال */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className='overflow-hidden'
          >
            <div
              className='relative mb-2 flex items-center gap-2 overflow-hidden rounded-2xl
                         border border-main-accent/30 bg-main-accent/10 px-3 py-2 ps-5'
            >
              <span className='absolute inset-y-0 start-0 w-1 rounded-full bg-gradient-to-b from-main-accent to-main-accent/30' />
              <HeroIcon
                className='h-4 w-4 shrink-0 rotate-180 text-main-accent-text'
                iconName='ArrowUturnLeftIcon'
              />
              <div className='flex min-w-0 flex-1 flex-col text-xs'>
                <span className='font-bold text-main-accent-text'>
                  الرد على {replyingTo.senderName}
                </span>
                <span className='truncate text-light-secondary dark:text-dark-secondary'>
                  {replyingTo.text ||
                    (replyingTo.type === 'audio'
                      ? 'رسالة صوتية'
                      : replyingTo.type === 'image'
                      ? 'صورة'
                      : replyingTo.type === 'video'
                      ? 'فيديو'
                      : '')}
                </span>
              </div>
              <button
                type='button'
                onClick={onCancelReply}
                aria-label='إلغاء الرد'
                className='shrink-0 rounded-full p-1.5 text-light-secondary transition
                           hover:bg-light-primary/10 dark:text-dark-secondary'
              >
                <HeroIcon className='h-4 w-4' iconName='XMarkIcon' />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* معاينة الوسائط والصوت قبل الإرسال */}
      <AnimatePresence>
        {(previews.length > 0 || voice) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className='mb-2 flex flex-wrap items-center gap-2 rounded-2xl border
                       border-light-border p-2 dark:border-dark-border'
          >
            {previews.map((preview) => (
              <div key={preview.id} className='relative'>
                {preview.type.startsWith('video/') ? (
                  <video
                    src={preview.url}
                    className='h-20 w-20 rounded-xl object-cover'
                    muted
                    playsInline
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={preview.url}
                    alt='معاينة'
                    className='h-20 w-20 rounded-xl object-cover'
                  />
                )}
                <button
                  type='button'
                  onClick={() => removeFile(preview.id)}
                  aria-label='إزالة'
                  className='absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center
                             rounded-full bg-black/80 text-white transition hover:bg-black'
                >
                  <HeroIcon className='h-3 w-3' iconName='XMarkIcon' />
                </button>
                {preview.type.startsWith('video/') && (
                  <span className='absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white'>
                    فيديو
                  </span>
                )}
              </div>
            ))}

            {voice && (
              <div
                className='relative flex w-full min-w-0 max-w-[260px] items-center rounded-xl
                           border border-light-border p-1.5 dark:border-dark-border'
              >
                <VoicePlayer
                  src={voice.url}
                  duration={voice.duration}
                  peaks={voice.peaks}
                  compact
                />
                <button
                  type='button'
                  onClick={() => {
                    URL.revokeObjectURL(voice.url);
                    setVoice(null);
                  }}
                  aria-label='حذف التسجيل'
                  className='absolute -left-1.5 -top-1.5 flex h-5 w-5 shrink-0 items-center
                             justify-center rounded-full bg-black/80 text-white
                             transition hover:bg-black'
                >
                  <HeroIcon className='h-3 w-3' iconName='XMarkIcon' />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className='flex items-end gap-1 rounded-3xl border border-light-border bg-main-search-background/70
                   px-1.5 py-1.5 shadow-sm transition focus-within:border-main-accent/60
                   focus-within:ring-4 focus-within:ring-main-accent/10 dark:border-dark-border'
      >
        {recording ? (
          <VoiceRecorder
            onCancel={() => setRecording(false)}
            onComplete={(blob, duration, peaks) => {
              setRecording(false);
              setVoice({
                blob,
                duration,
                peaks,
                url: URL.createObjectURL(blob)
              });
            }}
          />
        ) : (
          <>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*,video/*'
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              aria-label='إرفاق صورة أو فيديو'
              disabled={sending}
              className='custom-button dark-bg-tab shrink-0 p-2 text-main-accent-text hover:bg-light-primary/10 disabled:cursor-not-allowed
                         disabled:opacity-40 dark:hover:bg-dark-primary/10'
            >
              <HeroIcon className='h-6 w-6' iconName='PhotoIcon' />
            </button>

            <TextareaAutosize
              ref={textInputRef}
              value={text}
              onChange={(event) => {
                onMentionChange(event);
                if (event.target.value) notifyTyping();
                else stopTyping();
              }}
              onKeyDown={handleKeyDown}
              placeholder='اكتب رسالة...  @للإشارة'
              maxRows={4}
              className='max-h-32 flex-1 resize-none self-center bg-transparent px-2 py-1.5
                         text-[15px] outline-none placeholder:text-light-secondary
                         dark:placeholder:text-dark-secondary'
            />

            {hasContent || (isEditing && text.trim()) ? (
              <button
                type='button'
                onClick={() => void handleSend()}
                disabled={sending}
                aria-label='إرسال'
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  'bg-main-accent text-main-accent-contrast transition hover:brightness-90 active:scale-90',
                  'disabled:opacity-50'
                )}
              >
                {sending ? (
                  <span className='h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black' />
                ) : (
                  <HeroIcon
                    className={cn('h-5 w-5', !isEditing && '-scale-x-100')}
                    iconName={isEditing ? 'CheckIcon' : 'PaperAirplaneIcon'}
                    solid
                  />
                )}
              </button>
            ) : (
              <button
                type='button'
                onClick={() => setRecording(true)}
                aria-label='تسجيل رسالة صوتية'
                className='custom-button dark-bg-tab shrink-0 p-2 text-main-accent-text
                           hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
              >
                <HeroIcon className='h-6 w-6' iconName='MicrophoneIcon' />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
