import { useState } from 'react';
import cn from 'clsx';
import { useLanguage } from '@lib/context/language-context';
import { HeroIcon } from '@components/ui/hero-icon';
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
  /** When false, the grid is visible immediately (parent already toggles). */
  startOpen?: boolean;
};

export function FontPicker({
  value,
  onChange,
  compact,
  dark,
  startOpen = false
}: FontPickerProps): JSX.Element {
  const { t } = useLanguage();
  const selected = value || DEFAULT_TEXT_FONT;
  const selectedFont =
    TEXT_FONTS.find((font) => font.id === selected) ?? TEXT_FONTS[0];
  const [open, setOpen] = useState(startOpen);
  const [group, setGroup] = useState<TextFontGroup>(
    selectedFont?.group ?? 'ar'
  );
  const fonts = fontsByGroup(group);

  return (
    <div className='flex w-full flex-col gap-2'>
      <button
        type='button'
        onClick={(): void => setOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start transition',
          dark
            ? 'bg-white/10 text-white hover:bg-white/15'
            : 'bg-light-primary/5 hover:bg-light-primary/10 dark:bg-dark-primary/5 dark:hover:bg-dark-primary/10'
        )}
      >
        <span className='flex min-w-0 items-center gap-2'>
          <span
            className={cn(
              'text-[11px] font-bold',
              dark
                ? 'text-white/70'
                : 'text-light-secondary dark:text-dark-secondary'
            )}
          >
            {t('fonts.label')}
          </span>
          <span
            className='truncate text-[13px] font-semibold'
            style={{ fontFamily: selectedFont.css }}
          >
            {selectedFont.label}
          </span>
        </span>
        <HeroIcon
          className={cn(
            'h-4 w-4 shrink-0 transition',
            open && 'rotate-180',
            dark
              ? 'text-white/70'
              : 'text-light-secondary dark:text-dark-secondary'
          )}
          iconName='ChevronDownIcon'
        />
      </button>
      {open && (
        <>
          <div className='flex items-center justify-end'>
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
          <div
            className={cn(
              'grid gap-1.5',
              compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
            )}
          >
            {fonts.map((font) => {
              const active = selected === font.id;
              return (
                <button
                  key={font.id}
                  type='button'
                  onClick={(): void => onChange(font.id)}
                  title={font.sample}
                  className={cn(
                    'min-w-0 rounded-xl border px-2.5 py-2 text-center transition',
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
                    className='block truncate text-[13px] font-semibold leading-tight'
                    style={{ fontFamily: font.css }}
                  >
                    {font.label}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
