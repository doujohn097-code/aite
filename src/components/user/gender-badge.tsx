import cn from 'clsx';

type GenderBadgeProps = {
  gender?: 'male' | 'female' | null;
  className?: string;
};

type IconProps = { className?: string; strokeWidth?: number };

function MaleIcon({ className, strokeWidth = 2 }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <circle cx='10' cy='14' r='5.5' />
      <path d='M14.2 9.8 20 4' />
      <path d='M15 4h5v5' />
    </svg>
  );
}

function FemaleIcon({ className, strokeWidth = 2 }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <circle cx='12' cy='8.5' r='5.5' />
      <path d='M12 14v7' />
      <path d='M9 18h6' />
    </svg>
  );
}

/** أيقونة الجنس وحدها (تُستخدم في نافذة الإعداد) */
export function GenderIcon({
  gender,
  className,
  strokeWidth
}: IconProps & { gender: 'male' | 'female' }): JSX.Element {
  const Icon = gender === 'male' ? MaleIcon : FemaleIcon;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

/** بادج ملوّن يوضّح الجنس — أزرق للذكر ووردي للأنثى (يظهر في الملف الشخصي) */
export function GenderBadge({
  gender,
  className
}: GenderBadgeProps): JSX.Element | null {
  if (gender !== 'male' && gender !== 'female') return null;

  const isMale = gender === 'male';

  const Icon = isMale ? MaleIcon : FemaleIcon;

  return (
    <span
      className={cn(
        `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1
         text-xs font-bold leading-none ring-1 backdrop-blur`,
        isMale
          ? 'bg-[#1D9BF0]/15 text-[#1D9BF0] ring-[#1D9BF0]/40'
          : 'bg-[#F91A82]/15 text-[#F91A82] ring-[#F91A82]/40',
        className
      )}
    >
      <Icon className='h-3.5 w-3.5' />
      {isMale ? 'ذكر' : 'أنثى'}
    </span>
  );
}
