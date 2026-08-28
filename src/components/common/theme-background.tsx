import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '@lib/context/theme-context';
import { themesMeta } from '@lib/types/theme';

const EASE = [0.22, 0.61, 0.36, 1] as const;

/**
 * طبقة الخلفية السائلة — تتبدّل بتلاشٍ متقاطع ناعم مع تكبير وضبابية خفيفة
 * تبقى ثابتة خلف كامل التطبيق مع حجاب لوني يضمن وضوح النصوص.
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
            initial={{ opacity: 0.4, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.55, ease: EASE },
              scale: { duration: 0.9, ease: EASE }
            }}
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
            transition={{ duration: 0.85, ease: EASE }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
