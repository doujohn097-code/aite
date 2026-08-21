import { motion } from 'framer-motion';
import cn from 'clsx';

type TypingIndicatorProps = {
  className?: string;
};

export function TypingIndicator({ className }: TypingIndicatorProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'flex items-center gap-1.5 rounded-2xl rounded-bl-md border',
        'border-black/10 bg-black/5 px-4 py-3',
        'dark:border-white/15 dark:bg-white/10',
        className
      )}
    >
      <span className='typing-dot h-1.5 w-1.5 rounded-full bg-light-secondary dark:bg-dark-secondary' />
      <span className='typing-dot h-1.5 w-1.5 rounded-full bg-light-secondary dark:bg-dark-secondary' />
      <span className='typing-dot h-1.5 w-1.5 rounded-full bg-light-secondary dark:bg-dark-secondary' />
    </motion.div>
  );
}
