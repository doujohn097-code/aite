import cn from 'clsx';

type GenderBadgeProps = {
  gender?: 'male' | 'female' | null;
  className?: string;
};

/** بادج ملوّن يوضّح الجنس — أزرق للذكر ووردي للأنثى (يظهر في الملف الشخصي) */
export function GenderBadge({
  gender,
  className
}: GenderBadgeProps): JSX.Element | null {
  if (gender !== 'male' && gender !== 'female') return null;

  const isMale = gender === 'male';

  return (
    <span
      className={cn(
        `inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1
         text-xs font-bold leading-none ring-1 backdrop-blur`,
        isMale
          ? 'bg-[#1D9BF0]/15 text-[#1D9BF0] ring-[#1D9BF0]/40'
          : 'bg-[#F91A82]/15 text-[#F91A82] ring-[#F91A82]/40',
        className
      )}
    >
      <span className='text-sm leading-none'>{isMale ? '♂' : '♀'}</span>
      {isMale ? 'ذكر' : 'أنثى'}
    </span>
  );
}
