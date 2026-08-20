import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cn from 'clsx';
import { Twemoji } from './twemoji';
import { HeroIcon } from './hero-icon';
import { EMOJI_CATEGORIES } from './emoji-data';

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  className?: string;
};

/** لوحة إيموجي سلسة — سكرول أفقي ناعم، أصناف قابلة للتنقل،
 *  وأصناف حصرية لا توجد في منصات أخرى. */
export function EmojiPicker({
  onSelect,
  className
}: EmojiPickerProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState(0);

  // تتبع الصنف الظاهر أثناء السكرول
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = (): void => {
      const sections = container.querySelectorAll('[data-category]');
      let current = 0;
      sections.forEach((section, index) => {
        if ((section as HTMLElement).offsetTop - container.scrollTop < 48)
          current = index;
      });
      setActiveCategory(current);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const jumpTo = (index: number): void => {
    const container = scrollRef.current;
    const target = container?.querySelectorAll('[data-category]')[index];
    if (container && target)
      container.scrollTo({
        top: (target as HTMLElement).offsetTop - 4,
        behavior: 'smooth'
      });
  };

  return (
    <div
      className={cn(
        'flex h-72 w-72 flex-col overflow-hidden rounded-2xl border border-light-border bg-main-background shadow-2xl dark:border-dark-border',
        className
      )}
    >
      <div className='flex items-center gap-2 border-b border-light-border/60 px-3 py-2 dark:border-dark-border/60'>
        <HeroIcon
          className='h-4 w-4 text-main-accent'
          iconName='FaceSmileIcon'
        />
        <span className='text-sm font-bold'>إيموجي</span>
      </div>
      <div className='scrollbar-none flex gap-1 overflow-x-auto border-b border-light-border/60 px-2 py-1.5 dark:border-dark-border/60'>
        {EMOJI_CATEGORIES.map((category, index) => (
          <button
            key={category.label}
            type='button'
            onClick={() => jumpTo(index)}
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
              activeCategory === index
                ? 'bg-main-accent text-black'
                : 'text-light-secondary hover:bg-light-primary/10 dark:text-dark-secondary dark:hover:bg-dark-primary/10'
            )}
          >
            {category.label}
          </button>
        ))}
      </div>
      <div
        ref={scrollRef}
        className='emoji-scroll flex-1 overflow-y-auto overscroll-contain px-2 pb-2'
      >
        {EMOJI_CATEGORIES.map((category) => (
          <section key={category.label} data-category>
            <p className='sticky top-0 z-10 bg-main-background/95 py-1.5 text-[11px] font-bold text-light-secondary backdrop-blur dark:text-dark-secondary'>
              {category.label}
            </p>
            <div className='grid grid-cols-7 gap-0.5'>
              {category.emojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  type='button'
                  onClick={() => onSelect(emoji)}
                  className='flex items-center justify-center rounded-lg p-1.5 transition hover:bg-main-accent/10 active:scale-90'
                  aria-label={emoji}
                >
                  <Twemoji emoji={emoji} className='h-6 w-6' />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

type EmojiPickerButtonProps = {
  onSelect: (emoji: string) => void;
  className?: string;
  buttonClassName?: string;
};

/** زر يفتح لوحة الإيموجي أعلى حقل الكتابة — يُغلق باللمس خارج */
export function EmojiPickerButton({
  onSelect,
  className,
  buttonClassName
}: EmojiPickerButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <button
        type='button'
        aria-label='إضافة إيموجي'
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'custom-button dark-bg-tab shrink-0 p-2 text-main-accent hover:bg-light-primary/10 dark:hover:bg-dark-primary/10',
          buttonClassName
        )}
      >
        <HeroIcon className='h-6 w-6' iconName='FaceSmileIcon' />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button
              className='fixed inset-0 z-30 cursor-default'
              aria-label='إغلاق'
              onClick={() => setOpen(false)}
              type='button'
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className='absolute bottom-full z-40 mb-2'
            >
              <EmojiPicker
                onSelect={(emoji) => {
                  onSelect(emoji);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
