import { useEffect } from 'react';
import TextArea from 'react-textarea-autosize';
import { useLanguage } from '@lib/context/language-context';
import { useModal } from '@lib/hooks/useModal';
import { useMentionAssist } from '@lib/hooks/useMentionAssist';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { Button } from '@components/ui/button';
import { MentionSuggest } from './mention-suggest';
import { fontCss } from '@lib/text-fonts';
import type {
  ReactNode,
  RefObject,
  ChangeEvent,
  KeyboardEvent,
  ClipboardEvent
} from 'react';
import type { Variants } from 'framer-motion';

type InputFormProps = {
  modal?: boolean;
  formId: string;
  loading: boolean;
  visited: boolean;
  reply?: boolean;
  children: ReactNode;
  inputRef: RefObject<HTMLTextAreaElement>;
  inputValue: string;
  replyModal?: boolean;
  isValidTweet: boolean;
  isUploadingImages: boolean;
  sendTweet: () => Promise<void>;
  handleFocus: () => void;
  discardTweet: () => void;
  handleChange: ({
    target: { value }
  }: ChangeEvent<HTMLTextAreaElement>) => void;
  handleImageUpload: (
    e: ChangeEvent<HTMLInputElement> | ClipboardEvent<HTMLTextAreaElement>
  ) => void;
  font?: string | null;
};

const variants: Variants[] = [
  {
    initial: { y: -25, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { type: 'spring' } }
  },
  {
    initial: { x: 25, opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { type: 'spring' } }
  }
];

export const [fromTop, fromBottom] = variants;

export function InputForm({
  modal,
  reply,
  formId,
  loading,
  visited,
  children,
  inputRef,
  replyModal,
  inputValue,
  isValidTweet,
  isUploadingImages,
  sendTweet,
  handleFocus,
  discardTweet,
  handleChange,
  handleImageUpload,
  font
}: InputFormProps): JSX.Element {
  const { t } = useLanguage();
  const { open, openModal, closeModal } = useModal();
  const { mentionQuery, onMentionChange, insertMention, closeMentions } =
    useMentionAssist(
      inputValue,
      (next) => {
        handleChange({
          target: { value: next }
        } as ChangeEvent<HTMLTextAreaElement>);
      },
      inputRef
    );

  useEffect(() => handleShowHideNav(true), []);

  const handleKeyboardShortcut = ({
    key,
    ctrlKey
  }: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!modal && key === 'Escape')
      if (isValidTweet) {
        inputRef.current?.blur();
        openModal();
      } else discardTweet();
    else if (ctrlKey && key === 'Enter' && isValidTweet) void sendTweet();
  };

  const handleShowHideNav = (blur?: boolean) => (): void => {
    const sidebar = document.getElementById('sidebar') as HTMLElement;

    if (!sidebar) return;

    if (blur) {
      setTimeout(() => (sidebar.style.opacity = ''), 200);
      return;
    }

    if (window.innerWidth < 500) sidebar.style.opacity = '0';
  };

  const handleFormFocus = (): void => {
    handleShowHideNav()();
    handleFocus();
  };

  const handleClose = (): void => {
    discardTweet();
    closeModal();
  };

  return (
    <div className='flex min-h-[48px] w-full flex-col justify-center gap-4'>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={open}
        closeModal={closeModal}
      >
        <ActionModal
          title={t('compose.discardTitle')}
          description={t('compose.discardBody')}
          mainBtnClassName='bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/75'
          mainBtnLabel={t('action.discard')}
          action={handleClose}
          closeModal={closeModal}
        />
      </Modal>
      <div className='relative flex flex-col gap-6'>
        <MentionSuggest
          query={mentionQuery}
          onSelect={insertMention}
          onClose={closeMentions}
        />
        <div className='flex items-center gap-3'>
          <TextArea
            id={formId}
            dir='auto'
            className='user-text w-full min-w-0 resize-none bg-transparent text-xl outline-none
                       placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
            style={{ fontFamily: fontCss(font) }}
            value={inputValue}
            placeholder={
              reply || replyModal ? t('compose.reply') : t('compose.whatsNew')
            }
            onBlur={handleShowHideNav(true)}
            minRows={loading ? 1 : modal && !isUploadingImages ? 3 : 1}
            maxRows={isUploadingImages ? 5 : 15}
            onFocus={handleFormFocus}
            onPaste={handleImageUpload}
            onKeyUp={handleKeyboardShortcut}
            onChange={onMentionChange}
            ref={inputRef}
          />
          {reply && !visited && (
            <Button
              className='cursor-pointer bg-main-accent px-4 py-1.5 font-bold text-main-accent-contrast opacity-50'
              onClick={handleFocus}
            >
              {t('action.reply')}
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
