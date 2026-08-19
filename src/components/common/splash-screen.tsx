import { AnimatePresence, motion } from 'framer-motion';

type SplashScreenProps = {
  isVisible: boolean;
};

/**
 * Brand splash screen shown while the app boots.
 * Sequence: icon mark → a simple line → the wordmark → credit line.
 * Always rendered on a black canvas since the brand assets use white ink.
 */
export function SplashScreen({ isVisible }: SplashScreenProps): JSX.Element {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className='fixed inset-0 z-[200] flex flex-col items-center justify-center
                     bg-black px-6 text-center select-none'
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeInOut' } }}
        >
          {/* 1. Icon mark */}
          <motion.img
            src='/assets/logo.png'
            alt='Aite'
            className='h-24 w-24 object-contain'
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.15 }}
          />

          {/* 2. A simple line */}
          <motion.div
            className='mt-6 h-px w-28 origin-center bg-white/70'
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.85 }}
          />

          {/* 3. Wordmark */}
          <motion.img
            src='/assets/home-logo.png'
            alt='Aite'
            className='mt-6 h-14 w-auto object-contain'
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 1.45 }}
          />

          {/* 4. Credit */}
          <motion.p
            className='font-splash-credit mt-6 text-3xl text-white/90'
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 2.1 }}
          >
            from salem ahmed
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
