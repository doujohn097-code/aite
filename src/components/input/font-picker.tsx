import { useState } from 'react';
import cn from 'clsx';
import { useLanguage } from '@lib/context/language-context';
import {
  DEFAULT_TEXT_FONT,
  fontsByGroup,
  TEXT_FONTS,
  type TextFontGroup
} from '@lib/text-fonts';

type FontPickerProps = {
  value?: string | null;
  onChange: (id: string) => void;
  compact?: boolean;
  dark?: boolean;
};

export function FontPicker({
  value,
  onChange,
  compact,
  dark
}: FontPickerProps): JSX.Element {
  const { t } = useLanguage();
  const selected = value || DEFAULT_TEXT_FONT;
  const [group, setGroup] = useState<TextFontGroup>(
    TEXT_FONTS.find((font) => font.id === selected)?.group ?? 'ar'
  );
  const fonts = fontsByGroup(group);

  return (
    <div className='flex w-full flex-col gap-2'>
      <div className='flex items-center justify-between gap-2'>
        <p
          className={cn(
            'text-[11px] font-bold',
            dark ? 'text-white/70' : 'text-light-secondary dark:text-dark-secondary'
          )}
        >
          {t('fonts.label')}
        </p>
        <div
          className={cn(
            'flex rounded-full p-0.5 text-[11px] font-bold',
            dark ? 'bg-white/10' : 'bg-light-primary/10 dark:bg-white/10'
          )}
        >
          {(['ar', 'en'] as TextFontGroup[]).map((item) => (
            <button
              key={item}
              type='button'
              onClick={(): void => setGroup(item)}
              className={cn(
                'rounded-full px-2.5 py-1 transition',
                group === item
                  ? dark
                    ? 'bg-white text-black'
                    : 'bg-main-accent text-main-accent-contrast'
                  : dark
                  ? 'text-white/70'
                  : 'text-light-secondary dark:text-dark-secondary'
              )}
            >
              {item === 'ar' ? t('fonts.arabic') : t('fonts.latin')}
            </button>
          ))}
        </div>
      </div>
      <div className={cn('flex gap-2 overflow-x-auto pb-1', compact && 'gap-1.5')}>
        {fonts.map((font) => {
          const active = selected === font.id;
          return (
            <button
              key={font.id}
              type='button'
              onClick={(): void => onChange(font.id)}
              className={cn(
                'shrink-0 rounded-2xl border px-3 py-2 text-start transition',
                compact ? 'min-w-[7.5rem]' : 'min-w-[8.5rem]',
                active
                  ? dark
                    ? 'border-white bg-white text-black'
                    : 'border-main-accent bg-main-accent/10 text-light-primary dark:text-dark-primary'
                  : dark
                  ? 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                  : 'border-light-border bg-main-background hover:border-main-accent/40 dark:border-dark-border'
              )}
            >
              <span
                className='block truncate text-[13px] font-bold leading-tight'
                style={{ fontFamily: font.css }}
              >
                {font.label}
              </span>
              <span
                className={cn(
                  'mt-0.5 block truncate text-[11px] leading-tight',
                  active
                    ? dark
                      ? 'text-black/70'
                      : 'text-light-secondary dark:text-dark-secondary'
                    : dark
                    ? 'text-white/55'
                    : 'text-light-secondary dark:text-dark-secondary'
                )}
                style={{ fontFamily: font.css }}
              >
                {font.sample}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
