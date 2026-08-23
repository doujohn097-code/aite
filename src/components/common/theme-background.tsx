import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '@lib/context/theme-context';
import { themesMeta } from '@lib/types/theme';

/**
 * طبقة الخلفية السائلة — تتبدّل بتلاشٍ متقاطع ناعم عند تغيير المظهر
 * وتبقى ثابتة خلف كامل التطبيق مع حجاب لوني يضمن وضوح النصوص.
 */
export function ThemeBackground(): JSX.Element {
  const { theme } = useTheme();

  const { wallpaper } = themesMeta[theme];

  return (
    <div className='theme-background' aria-hidden='true'>
      <AnimatePresence initial={false}>
        {wallpaper && (
          <motion.div
            key={wallpaper}
            className='theme-background__image'
            style={{ backgroundImage: `url('${wallpaper}')` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 0.61, 0.36, 1] }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {wallpaper && (
          <motion.div
            key={`${wallpaper}-veil`}
            className='theme-background__veil'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
