import cn from 'clsx';

type GenderBadgeProps = {
  gender?: 'male' | 'female' | null;
  className?: string;
};

/** بادج ملوّن صغير يوضّح الجنس بجانب الاسم — أزرق للذكر ووردي للأنثى */
export function GenderBadge({
  gender,
  className
}: GenderBadgeProps): JSX.Element | null {
  if (gender !== 'male' && gender !== 'female') return null;

  const isMale = gender === 'male';

  return (
    <span
      title={isMale ? 'ذكر' : 'أنثى'}
      aria-label={isMale ? 'ذكر' : 'أنثى'}
      className={cn(
        `inline-flex shrink-0 items-center justify-center rounded-full
         font-bold leading-none ring-1`,
        isMale
          ? 'bg-[#1D9BF0]/15 text-[#1D9BF0] ring-[#1D9BF0]/35'
          : 'bg-[#F91A82]/15 text-[#F91A82] ring-[#F91A82]/35',
        className ?? 'h-[18px] w-[18px] text-[11px]'
      )}
    >
      {isMale ? '♂' : '♀'}
    </span>
  );
}
