import { motion } from 'framer-motion';
import cn from 'clsx';
import { useTheme } from '@lib/context/theme-context';
import { themesList, themesMeta } from '@lib/types/theme';
import { HeroIcon } from '@components/ui/hero-icon';
import type { MouseEvent } from 'react';
import type { Theme } from '@lib/types/theme';

type ThemePickerProps = {
  className?: string;
};

/** بطاقات اختيار المظهر — تشمل المظاهر الكلاسيكية والخلفيات السائلة */
export function ThemePicker({ className }: ThemePickerProps): JSX.Element {
  const { theme: currentTheme, setTheme } = useTheme();

  const handlePick =
    (theme: Theme) =>
    (event: MouseEvent<HTMLButtonElement>): void => {
      const { clientX, clientY } = event;

      const { left, top, width, height } =
        event.currentTarget.getBoundingClientRect();

      setTheme(theme, {
        x: clientX || left + width / 2,
        y: clientY || top + height / 2
      });
    };

  /** تحميل مسبق للخلفية عند اقتراب المؤشر حتى يكون التبديل فوريًا */
  const preload = (theme: Theme) => (): void => {
    const { wallpaper } = themesMeta[theme];
    if (!wallpaper) return;
    const image = new Image();
    image.src = wallpaper;
  };

  return (
    <div className={cn('grid grid-cols-2 gap-2.5 xs:grid-cols-3', className)}>
      {themesList.map((theme) => {
        const { label, description, preview, thumbnail, dark } =
          themesMeta[theme];

        const isActive = theme === currentTheme;

        return (
          <button
            key={theme}
            type='button'
            onClick={handlePick(theme)}
            onPointerEnter={preload(theme)}
            onFocus={preload(theme)}
            aria-pressed={isActive}
            aria-label={label}
            className={cn(
              `group relative overflow-hidden rounded-2xl p-[2px] text-start outline-none
               transition duration-300 active:scale-[0.97]`,
              isActive
                ? 'ring-2 ring-main-accent ring-offset-2 ring-offset-main-background'
                : 'ring-1 ring-light-border hover:ring-main-accent/50 dark:ring-dark-border'
            )}
          >
            <span
              className='relative flex h-[104px] w-full flex-col justify-end overflow-hidden
                         rounded-[14px] p-2.5'
              style={{
                background: preview,
                ...(thumbnail && {
                  backgroundImage: `url('${thumbnail}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                })
              }}
            >
              <span
                aria-hidden
                className='absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent
                           transition-opacity duration-300 group-hover:opacity-80'
              />
              <span className='relative z-10 flex flex-col leading-tight'>
                <span className='text-[13px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]'>
                  {label}
                </span>
                <span className='truncate text-[10px] text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]'>
                  {description}
                </span>
              </span>

              {isActive && (
                <motion.span
                  layoutId='theme-picker-check'
                  className='absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center
                             rounded-full bg-main-accent text-main-accent-contrast shadow-lg'
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                >
                  <HeroIcon className='h-4 w-4' iconName='CheckIcon' solid />
                </motion.span>
              )}

              {!thumbnail && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-bold',
                    dark ? 'bg-black/50 text-white' : 'bg-white/70 text-black'
                  )}
                >
                  {dark ? 'داكن' : 'فاتح'}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
