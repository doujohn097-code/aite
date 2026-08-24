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
          <div className='flex items-center gap-7'>
            {/* 1. Icon mark on the left */}
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

            {/* 2. Divider line blooming between the two marks */}
            <motion.div
              className='h-16 w-px origin-center bg-white/70'
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut', delay: 0.8 }}
            />

            {/* 3. Second logo on the right + credit underneath it */}
            <div className='flex flex-col gap-1.5'>
              <motion.img
                src='/assets/home-logo.png'
                alt='Aite'
                className='h-11 w-auto object-contain'
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 1.25 }}
              />
              <motion.p
                className='font-splash-credit text-lg leading-none text-white/90'
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 1.9 }}
              >
                from salem ahmed
              </motion.p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
