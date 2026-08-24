import { useRef } from 'react';
import { useT } from '@lib/context/language-context';
import { motion } from 'framer-motion';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { variants } from './input';
import { ProgressBar } from './progress-bar';
import type { ChangeEvent, ClipboardEvent } from 'react';
import type { IconName } from '@components/ui/hero-icon';

const options: Readonly<
  { nameKey: 'compose.media'; iconName: IconName; disabled: boolean }[]
> = [
  {
    nameKey: 'compose.media',
    iconName: 'PhotoIcon',
    disabled: false
  }
];

type InputOptionsProps = {
  reply?: boolean;
  modal?: boolean;
  loading?: boolean;
  inputLimit: number;
  inputLength: number;
  isValidTweet: boolean;
  isCharLimitExceeded: boolean;
  onRecordVoice?: () => void;
  handleImageUpload: (
    e: ChangeEvent<HTMLInputElement> | ClipboardEvent<HTMLTextAreaElement>
  ) => void;
};

export function InputOptions({
  reply,
  modal,
  loading,
  inputLimit,
  inputLength,
  isValidTweet,
  isCharLimitExceeded,
  onRecordVoice,
  handleImageUpload
}: InputOptionsProps): JSX.Element {
  const t = useT();
  const inputFileRef = useRef<HTMLInputElement>(null);

  const onClick = (): void => inputFileRef.current?.click();

  return (
    <motion.div className='flex justify-between' {...variants}>
      <div className='flex text-main-accent-text'>
        <input
          className='hidden'
          type='file'
          accept='image/*,video/*,audio/*'
          onChange={handleImageUpload}
          ref={inputFileRef}
          multiple
        />
        {options.map(({ nameKey, iconName }) => (
          <Button
            className='accent-tab accent-bg-tab group relative rounded-full p-2
                       hover:bg-main-accent/10 active:bg-main-accent/20'
            onClick={onClick}
            key={nameKey}
          >
            <HeroIcon className='h-5 w-5' iconName={iconName} />
            <ToolTip tip={t(nameKey)} modal={modal} />
          </Button>
        ))}
        {onRecordVoice && (
          <Button
            className='accent-tab accent-bg-tab group relative rounded-full p-2
                       hover:bg-main-accent/10 active:bg-main-accent/20'
            onClick={onRecordVoice}
          >
            <HeroIcon className='h-5 w-5' iconName='MicrophoneIcon' />
            <ToolTip tip={t('compose.voice')} modal={modal} />
          </Button>
        )}
      </div>
      <div className='flex items-center gap-4'>
        <motion.div
          className='flex items-center gap-4'
          animate={
            inputLength ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }
          }
        >
          <ProgressBar
            modal={modal}
            inputLimit={inputLimit}
            inputLength={inputLength}
            isCharLimitExceeded={isCharLimitExceeded}
          />
        </motion.div>
        <Button
          type='submit'
          className='accent-tab bg-main-accent px-4 py-1.5 font-bold text-main-accent-contrast
                     enabled:hover:bg-main-accent/90
                     enabled:active:bg-main-accent/75'
          disabled={!isValidTweet}
          loading={loading}
        >
          {reply ? t('action.reply') : t('compose.publish')}
        </Button>
      </div>
    </motion.div>
  );
}
