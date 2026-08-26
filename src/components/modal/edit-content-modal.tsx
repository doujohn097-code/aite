import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import TextArea from 'react-textarea-autosize';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { useMentionAssist } from '@lib/hooks/useMentionAssist';
import { uploadImages } from '@lib/firebase/utils';
import { getImagesData } from '@lib/validation';
import { Modal } from './modal';
import { MentionSuggest } from '@components/input/mention-suggest';
import { ImagePreview } from '@components/input/image-preview';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';
import { useLanguage } from '@lib/context/language-context';
import { FontPicker } from '@components/input/font-picker';
import { DEFAULT_TEXT_FONT, fontCss } from '@lib/text-fonts';

export type EditMediaKind = 'none' | 'images' | 'video';

export type EditContentSave = {
  text: string;
  images: ImagesPreview | null;
  font?: string | null;
};

type EditContentModalProps = {
  open: boolean;
  closeModal: () => void;
  title: string;
  initialText: string;
  initialFont?: string | null;
  initialImages?: ImagesPreview | null;
  mediaKind?: EditMediaKind;
  maxLength?: number;
  allowEmpty?: boolean;
  placeholder?: string;
  onSave: (next: EditContentSave) => Promise<void>;
};

export function EditContentModal({
  open,
  closeModal,
  title,
  initialText,
  initialFont,
  initialImages = null,
  mediaKind = 'none',
  maxLength,
  allowEmpty,
  placeholder,
  onSave
}: EditContentModalProps): JSX.Element {
  const { t } = useLanguage();
  const fieldPlaceholder = placeholder ?? t('media.editCaption');

  const { user, isAdmin } = useAuth();
  const limit = maxLength ?? (isAdmin ? 560 : 280);
  const maxFiles = mediaKind === 'video' ? 1 : 4;
  const [value, setValue] = useState(initialText);
  const [font, setFont] = useState(initialFont || DEFAULT_TEXT_FONT);
  const [keptImages, setKeptImages] = useState<ImagesPreview>(
    initialImages ?? []
  );
  const [newFiles, setNewFiles] = useState<FilesWithId>([]);
  const [newPreview, setNewPreview] = useState<ImagesPreview>([]);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mentionQuery, onMentionChange, insertMention, closeMentions } =
    useMentionAssist(value, setValue, inputRef);

  useEffect(() => {
    if (!open) return;
    setValue(initialText);
    setFont(initialFont || DEFAULT_TEXT_FONT);
    setKeptImages(initialImages ?? []);
    setNewFiles([]);
    setNewPreview([]);
    setUploadProgress(0);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      const end = initialText.length;
      try {
        inputRef.current?.setSelectionRange(end, end);
      } catch {
        /* ignore */
      }
    }, 40);
    return () => window.clearTimeout(timer);
  }, [open, initialText, initialFont, initialImages]);

  const previewImages = [...keptImages, ...newPreview];
  const trimmed = value.trim();
  const tooLong = value.length > limit;
  const initialIds = (initialImages ?? []).map((image) => image.id).join('|');
  const keptIds = keptImages.map((image) => image.id).join('|');
  const mediaChanged = keptIds !== initialIds || newFiles.length > 0;
  const textChanged = trimmed !== initialText.trim();
  const fontChanged =
    (font || DEFAULT_TEXT_FONT) !== (initialFont || DEFAULT_TEXT_FONT);
  const hasMedia = previewImages.length > 0;
  const canSave =
    !tooLong &&
    (textChanged || mediaChanged || fontChanged) &&
    (allowEmpty || !!trimmed || hasMedia);

  const handleFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const remaining = maxFiles - keptImages.length - newFiles.length;
    const imagesData = getImagesData(event.target.files, {
      currentFiles: maxFiles - remaining,
      allowUploadingVideos: true
    });
    if (fileRef.current) fileRef.current.value = '';
    if (!imagesData) {
      toast.error(
        mediaKind === 'video' ? t('media.pickVideo') : t('media.pickMedia')
      );
      return;
    }
    if (mediaKind === 'video') {
      const video = imagesData.selectedImagesData.find((file) =>
        (file.type || '').startsWith('video/')
      );
      if (!video) {
        toast.error(t('media.reelNeedsFile'));
        return;
      }
      newPreview.forEach(({ src }) => {
        if (src.startsWith('blob:')) URL.revokeObjectURL(src);
      });
      setKeptImages([]);
      setNewFiles([video]);
      setNewPreview([imagesData.imagesPreviewData[0]]);
      return;
    }
    const room = Math.max(0, remaining);
    setNewFiles((prev) => [
      ...prev,
      ...imagesData.selectedImagesData.slice(0, room)
    ]);
    setNewPreview((prev) => [
      ...prev,
      ...imagesData.imagesPreviewData.slice(0, room)
    ]);
  };

  const removeImage = (targetId: string) => (): void => {
    const fromKept = keptImages.find((image) => image.id === targetId);
    if (fromKept) {
      setKeptImages((prev) => prev.filter((image) => image.id !== targetId));
      return;
    }
    const preview = newPreview.find((image) => image.id === targetId);
    if (preview?.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
    setNewFiles((prev) => prev.filter((file) => file.id !== targetId));
    setNewPreview((prev) => prev.filter((image) => image.id !== targetId));
  };

  const handleSave = async (): Promise<void> => {
    if (!canSave || saving) return;
    setSaving(true);
    setUploadProgress(0);
    try {
      let uploaded: ImagesPreview = [];
      if (newFiles.length) {
        if (!user?.id) throw new Error(t('err.needLogin'));
        uploaded =
          (await uploadImages(user.id, newFiles, setUploadProgress)) ?? [];
      }
      const images = [...keptImages, ...uploaded];
      await onSave({
        text: trimmed,
        images: images.length ? images : null,
        font: trimmed ? font : null
      });
      closeMentions();
      closeModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('err.saveEdit'));
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  return (
    <Modal
      open={open}
      closeModal={saving ? (): void => undefined : closeModal}
      modalClassName='w-full max-w-lg overflow-hidden rounded-3xl border border-light-border bg-main-background shadow-2xl dark:border-dark-border'
    >
      <div
        className='flex flex-col'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex items-center justify-between border-b border-light-border px-5 py-4 dark:border-dark-border'>
          <div className='flex items-center gap-2.5'>
            <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-main-accent/15 text-main-accent-text'>
              <HeroIcon className='h-5 w-5' iconName='PencilSquareIcon' />
            </span>
            <h2 className='text-lg font-bold'>{title}</h2>
          </div>
          <Button
            className='rounded-full p-2 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
            onClick={closeModal}
            disabled={saving}
          >
            <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
          </Button>
        </div>

        <div className='relative max-h-[70vh] overflow-y-auto px-5 py-4'>
          <MentionSuggest
            query={mentionQuery}
            onSelect={insertMention}
            onClose={closeMentions}
          />
          <TextArea
            ref={inputRef}
            value={value}
            onChange={onMentionChange}
            placeholder={fieldPlaceholder}
            minRows={4}
            maxRows={10}
            dir='auto'
            style={{ fontFamily: fontCss(font) }}
            className='user-text w-full resize-none rounded-2xl border border-light-border bg-light-primary/5 p-3.5 text-base outline-none focus:border-main-accent dark:border-dark-border dark:bg-dark-primary/5'
          />
          <div className='mt-3'>
            <FontPicker value={font} onChange={setFont} compact />
          </div>
          <p
            className={`mt-2 text-end text-xs ${
              tooLong
                ? 'font-bold text-accent-red'
                : 'text-light-secondary dark:text-dark-secondary'
            }`}
          >
            {value.length} / {limit}
          </p>

          {mediaKind !== 'none' && (
            <div className='mt-4 flex flex-col gap-3'>
              {!!previewImages.length && (
                <ImagePreview
                  imagesPreview={previewImages}
                  previewCount={previewImages.length}
                  removeImage={!saving ? removeImage : undefined}
                />
              )}
              <input
                ref={fileRef}
                type='file'
                className='hidden'
                accept={
                  mediaKind === 'video'
                    ? 'video/mp4,video/quicktime,video/webm,video/*'
                    : 'image/*,video/*'
                }
                multiple={mediaKind !== 'video'}
                onChange={handleFiles}
              />
              <Button
                className='flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-light-border py-3 text-sm font-bold hover:border-main-accent hover:bg-main-accent/5 dark:border-dark-border'
                onClick={(): void => fileRef.current?.click()}
                disabled={
                  saving ||
                  (mediaKind === 'images' && previewImages.length >= maxFiles)
                }
              >
                <HeroIcon className='h-5 w-5' iconName='PhotoIcon' />
                {mediaKind === 'video'
                  ? previewImages.length
                    ? t('media.replaceVideo')
                    : t('media.addVideo')
                  : t('media.addMedia')}
              </Button>
            </div>
          )}

          {saving && uploadProgress > 0 && (
            <div className='mt-3 flex flex-col gap-1.5'>
              <div className='flex items-center justify-between text-xs text-light-secondary dark:text-dark-secondary'>
                <span>{t('media.uploadingShort')}</span>
                <span className='tabular-nums'>{uploadProgress}%</span>
              </div>
              <div className='h-1.5 w-full overflow-hidden rounded-full bg-light-border dark:bg-dark-border'>
                <div
                  className='h-full rounded-full bg-main-accent transition-all'
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className='flex items-center justify-end gap-2 border-t border-light-border px-5 py-4 dark:border-dark-border'>
          <Button
            className='rounded-full px-4 py-2 text-sm text-light-secondary dark:text-dark-secondary'
            onClick={closeModal}
            disabled={saving}
          >
            {t('common.cancel')}
          </Button>
          <Button
            className='rounded-full bg-main-accent px-5 py-2.5 font-bold text-main-accent-contrast disabled:opacity-40'
            onClick={handleSave}
            loading={saving}
            disabled={!canSave}
          >
            {t('media.saveEdit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
