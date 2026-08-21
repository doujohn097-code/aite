import cn from 'clsx';
import { CustomIcon } from './custom-icon';

type LoadingProps = {
  className?: string;
  iconClassName?: string;
};

export function Loading({
  className,
  iconClassName
}: LoadingProps): JSX.Element {
  return (
    <i
      role='status'
      aria-label='جارٍ التحميل'
      className={cn('flex justify-center', className ?? 'p-4')}
    >
      <span className='flex h-10 w-10 items-center justify-center rounded-full bg-main-accent/10 text-main-accent ring-1 ring-main-accent/15'>
        <CustomIcon className={cn('text-current', iconClassName ?? 'h-5 w-5')} iconName='SpinnerIcon' />
      </span>
    </i>
  );
}
