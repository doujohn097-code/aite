import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cn from 'clsx';
import { LinkifiedText } from './linkified-text';

type ExpandableTextProps = {
  text: string;
  /** Characters shown before truncating */
  maxChars?: number;
  className?: string;
  buttonClassName?: string;
};

/**
 * Renders long text with an animated "عرض المزيد / عرض أقل" toggle.
 */
export function ExpandableText({
  text,
  maxChars = 160,
  className,
  buttonClassName
}: ExpandableTextProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > maxChars;

  const shown =
    !isLong || expanded ? text : `${text.slice(0, maxChars).trimEnd()}…`;

  return (
    <div className={className}>
      <AnimatePresence initial={false}>
        <motion.p
          key={expanded ? 'full' : 'short'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className='whitespace-pre-line break-words'
        >
          <LinkifiedText text={shown} />
        </motion.p>
      </AnimatePresence>
      {isLong && (
        <button
          type='button'
          onClick={(): void => setExpanded((v) => !v)}
          className={cn(
            'mt-1 text-sm font-semibold text-main-accent-text hover:underline',
            buttonClassName
          )}
        >
          {expanded ? 'عرض أقل' : 'عرض المزيد'}
        </button>
      )}
    </div>
  );
}
