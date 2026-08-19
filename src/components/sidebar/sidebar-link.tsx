import { useRouter } from 'next/router';
import Link from 'next/link';
import cn from 'clsx';
import { preventBubbling } from '@lib/utils';
import { HeroIcon } from '@components/ui/hero-icon';
import type { NavLink } from './sidebar';

type SidebarLinkProps = NavLink & {
  username?: string;
  badge?: number;
  badgeClassName?: string;
};

export function SidebarLink({
  href,
  username,
  iconName,
  linkName,
  disabled,
  canBeHidden,
  badge,
  badgeClassName
}: SidebarLinkProps): JSX.Element {
  const { asPath } = useRouter();
  const isActive = username ? asPath.includes(username) : asPath === href;

  const showBadge = typeof badge === 'number' && badge > 0;

  const anchor = (
    <a
      className={cn(
        'group relative py-1 outline-none',
        canBeHidden ? 'hidden xs:flex' : 'flex',
        disabled && 'cursor-not-allowed'
      )}
      onClick={disabled ? preventBubbling() : undefined}
    >
      <div
        className={cn(
          `custom-button flex items-center justify-center gap-4 self-start p-2 text-xl transition 
           duration-200 group-hover:bg-light-primary/10 group-focus-visible:ring-2 
           group-focus-visible:ring-[#878a8c] dark:group-hover:bg-dark-primary/10 
           dark:group-focus-visible:ring-white xs:p-3 xl:pr-5`,
          isActive && 'font-bold'
        )}
      >
        <span className='relative'>
          <HeroIcon className='h-7 w-7' iconName={iconName} solid={isActive} />
          {showBadge && (
            <span
              className={cn(
                'absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                badgeClassName ?? 'bg-main-accent text-black'
              )}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        <p className='hidden xl:block'>{linkName}</p>
      </div>
    </a>
  );

  return disabled ? anchor : <Link href={href}>{anchor}</Link>;
}
