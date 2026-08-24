import { useEffect, useRef, useState } from 'react';
import TextArea from 'react-textarea-autosize';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { useMentionAssist } from '@lib/hooks/useMentionAssist';
import { Modal } from './modal';
import { MentionSuggest } from '@components/input/mention-suggest';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';

type EditContentModalProps = {
  open: boolean;
  closeModal: () => void;
  title: string;
  initialText: string;
  maxLength?: number;
  allowEmpty?: boolean;
  placeholder?: string;
  onSave: (text: string) => Promise<void>;
};

export function EditContentModal({
  open,
  closeModal,
  title,
  initialText,
  maxLength,
  allowEmpty,
  placeholder = 'عدّل النص…  @للإشارة',
  onSave
}: EditContentModalProps): JSX.Element {
  const { isAdmin } = useAuth();
  const limit = maxLength ?? (isAdmin ? 560 : 280);
  const [value, setValue] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { mentionQuery, onMentionChange, insertMention, closeMentions } =
    useMentionAssist(value, setValue, inputRef);

  useEffect(() => {
    if (!open) return;
    setValue(initialText);
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
  }, [open, initialText]);

  const trimmed = value.trim();
  const tooLong = value.length > limit;
  const unchanged = trimmed === initialText.trim();
  const canSave = !tooLong && !unchanged && (allowEmpty || !!trimmed);

  const handleSave = async (): Promise<void> => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      closeMentions();
      closeModal();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'تعذر حفظ التعديل. حاول مجددًا.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      closeModal={saving ? (): void => undefined : closeModal}
      modalClassName='w-full max-w-lg overflow-hidden rounded-3xl border border-light-border bg-main-background shadow-2xl dark:border-dark-border'
    >
      <div className='flex flex-col' onClick={(event) => event.stopPropagation()}>
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

        <div className='relative px-5 py-4'>
          <MentionSuggest
            query={mentionQuery}
            onSelect={insertMention}
            onClose={closeMentions}
          />
          <TextArea
            ref={inputRef}
            value={value}
            onChange={onMentionChange}
            placeholder={placeholder}
            minRows={4}
            maxRows={12}
            className='w-full resize-none rounded-2xl border border-light-border bg-light-primary/5 p-3.5 text-base outline-none focus:border-main-accent dark:border-dark-border dark:bg-dark-primary/5'
          />
          <p
            className={`mt-2 text-end text-xs ${
              tooLong
                ? 'font-bold text-accent-red'
                : 'text-light-secondary dark:text-dark-secondary'
            }`}
          >
            {value.length} / {limit}
          </p>
        </div>

        <div className='flex items-center justify-end gap-2 border-t border-light-border px-5 py-4 dark:border-dark-border'>
          <Button
            className='rounded-full px-4 py-2 text-sm text-light-secondary dark:text-dark-secondary'
            onClick={closeModal}
            disabled={saving}
          >
            إلغاء
          </Button>
          <Button
            className='rounded-full bg-main-accent px-5 py-2.5 font-bold text-main-accent-contrast disabled:opacity-40'
            onClick={handleSave}
            loading={saving}
            disabled={!canSave}
          >
            حفظ التعديل
          </Button>
        </div>
      </div>
    </Modal>
  );
}
