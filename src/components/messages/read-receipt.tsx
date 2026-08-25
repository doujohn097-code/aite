import cn from 'clsx';
import { useLanguage } from '@lib/context/language-context';

type ReadReceiptProps = {
  seen: boolean;
  className?: string;
};

export function ReadReceipt({
  seen,
  className
}: ReadReceiptProps): JSX.Element {
  const { t } = useLanguage();
  return (
    <span
      className={cn('inline-flex items-center', className)}
      title={seen ? t('chat.read') : t('chat.sent')}
      aria-label={seen ? t('chat.read') : t('chat.sent')}
    >
      <svg
        viewBox='0 0 18 12'
        className={cn(
          'h-3.5 w-[18px]',
          seen ? 'text-sky-400' : 'text-current opacity-70'
        )}
        fill='none'
        aria-hidden
      >
        <path
          d='M1.2 6.4 4.6 9.7 11.6 1.6'
          stroke='currentColor'
          strokeWidth='1.8'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='M6.4 6.4 9.8 9.7 16.8 1.6'
          stroke='currentColor'
          strokeWidth='1.8'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </span>
  );
}
