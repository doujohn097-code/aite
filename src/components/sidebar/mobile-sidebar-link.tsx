import Link from 'next/link';
import cn from 'clsx';
import { preventBubbling } from '@lib/utils';
import { HeroIcon } from '@components/ui/hero-icon';
import type { MobileNavLink } from '@components/modal/mobile-sidebar-modal';

type MobileSidebarLinkProps = MobileNavLink & {
  bottom?: boolean;
  onClick?: () => void;
};

export function MobileSidebarLink({
  href,
  bottom,
  linkName,
  iconName,
  disabled,
  onClick
}: MobileSidebarLinkProps): JSX.Element {
  return (
    <Link href={href} key={href}>
      <a
        className={cn(
          `group flex items-center rounded-xl font-medium transition-colors
           hover:bg-main-accent/10 active:bg-main-accent/20`,
          bottom ? 'gap-3 p-2 text-sm' : 'gap-3.5 px-3 py-2.5 text-base',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        onClick={(e): void => {
          if (disabled) {
            preventBubbling()(e);
            return;
          }
          onClick?.();
        }}
      >
        <HeroIcon
          className={cn(
            bottom ? 'h-5 w-5' : 'h-6 w-6',
            'text-light-secondary transition group-hover:text-main-accent dark:text-dark-secondary dark:group-hover:text-main-accent'
          )}
          iconName={iconName}
        />
        <span className='truncate text-light-primary dark:text-dark-primary font-semibold'>{linkName}</span>
      </a>
    </Link>
  );
}
