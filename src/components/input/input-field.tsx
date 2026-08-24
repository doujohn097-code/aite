import { useState } from 'react';
import cn from 'clsx';
import { useLanguage } from '@lib/context/language-context';
import { HeroIcon } from '@components/ui/hero-icon';
import type { KeyboardEvent, ChangeEvent, InputHTMLAttributes } from 'react';

export type InputFieldProps = {
  label: string;
  inputId: string;
  inputValue: string | null;
  inputLimit?: number;
  useTextArea?: boolean;
  type?: string;
  name?: string;
  autoComplete?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  errorMessage?: string;
  handleChange: (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handleKeyboardShortcut?: ({
    key,
    ctrlKey
  }: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

export function InputField({
  label,
  inputId,
  inputValue,
  inputLimit,
  useTextArea,
  type = 'text',
  name,
  autoComplete,
  inputMode,
  errorMessage,
  handleChange,
  handleKeyboardShortcut
}: InputFieldProps): JSX.Element {
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && showPassword ? 'text' : type;

  const slicedInputValue = inputValue?.slice(0, inputLimit) ?? '';

  const inputLength = slicedInputValue.length;
  const isHittingInputLimit = inputLimit && inputLength > inputLimit;

  return (
    <div className='flex flex-col gap-1'>
      <div
        className={cn(
          'relative rounded ring-1 transition-shadow duration-200',
          errorMessage
            ? 'ring-accent-red'
            : `ring-light-line-reply focus-within:ring-2 
                 focus-within:!ring-main-accent dark:ring-dark-border`
        )}
      >
        {useTextArea ? (
          <textarea
            className='peer mt-6 w-full resize-none bg-inherit px-3 pb-1
                       text-light-primary placeholder-transparent outline-none
                       transition dark:text-dark-primary'
            id={inputId}
            placeholder={inputId}
            onChange={!isHittingInputLimit ? handleChange : undefined}
            onKeyUp={handleKeyboardShortcut}
            value={slicedInputValue}
            rows={3}
          />
        ) : (
          <input
            className={cn(
              `peer mt-6 w-full bg-inherit px-3 pb-1 text-light-primary
               placeholder-transparent outline-none transition dark:text-dark-primary`,
              isPassword && 'pl-11'
            )}
            id={inputId}
            name={name ?? inputId}
            autoComplete={autoComplete}
            type={effectiveType}
            inputMode={inputMode}
            placeholder={inputId}
            onChange={!isHittingInputLimit ? handleChange : undefined}
            value={slicedInputValue}
            onKeyUp={handleKeyboardShortcut}
          />
        )}
        {isPassword && (
          <button
            type='button'
            aria-label={
              showPassword ? t('action.hidePass') : t('action.showPass')
            }
            onClick={(): void => setShowPassword((prev) => !prev)}
            className='absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1.5
                       text-light-secondary transition hover:bg-light-primary/10
                       dark:text-dark-secondary dark:hover:bg-dark-primary/10'
          >
            <HeroIcon
              className='h-5 w-5'
              iconName={showPassword ? 'EyeSlashIcon' : 'EyeIcon'}
            />
          </button>
        )}
        <label
          className={cn(
            `group-peer pointer-events-none absolute right-3 translate-y-1 bg-inherit text-sm
             text-light-secondary transition-all peer-placeholder-shown:translate-y-3
             peer-placeholder-shown:text-lg peer-focus:translate-y-1 peer-focus:text-sm
             dark:text-dark-secondary`,
            errorMessage
              ? '!text-accent-red peer-focus:text-accent-red'
              : 'peer-focus:text-main-accent-text'
          )}
          htmlFor={inputId}
        >
          {label}
        </label>
        {inputLimit && (
          <span
            className={cn(
              `absolute right-3 top-0 translate-y-1 text-sm text-light-secondary transition-opacity 
               duration-200 peer-focus:visible peer-focus:opacity-100 dark:text-dark-secondary`,
              errorMessage ? 'visible opacity-100' : 'invisible opacity-0'
            )}
          >
            {inputLength} / {inputLimit}
          </span>
        )}
      </div>
      {errorMessage && (
        <p className='text-sm text-accent-red'>{errorMessage}</p>
      )}
    </div>
  );
}
