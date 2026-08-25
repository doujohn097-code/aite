import { AnimatePresence, motion } from 'framer-motion';

type SplashScreenProps = {
  isVisible: boolean;
  playId?: number;
};

/**
 * Brand splash screen shown while the app boots.
 * Horizontal sequence: icon mark on the left → a divider line blooming
 * between → the second logo on the right → credit line underneath.
 * Always rendered on a black canvas since the brand assets use white ink.
 */
export function SplashScreen({
  isVisible,
  playId = 0
}: SplashScreenProps): JSX.Element {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          dir='ltr'
          className='fixed inset-0 z-[200] flex select-none flex-col items-center
                     justify-center gap-6 bg-black px-6 text-center'
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.5, ease: 'easeInOut' }
          }}
        >
          <div className='flex flex-col items-center gap-7'>
            <div className='flex items-center gap-7'>
              <motion.img
                src='/assets/logo.png'
                alt='Aite'
                className='h-16 w-16 object-contain'
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                  delay: 0.15
                }}
              />

              <motion.div
                className='h-16 w-px origin-center bg-white/70'
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut', delay: 0.8 }}
              />

              <motion.img
                src='/assets/home-logo.png'
                alt='Aite'
                className='h-11 w-auto object-contain'
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 1.25 }}
              />
            </div>

            <motion.p
              className='font-splash-credit text-[26px] leading-snug text-white sm:text-[30px]'
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 1.7 }}
            >
              from <em>Salem Ahmed</em>
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
