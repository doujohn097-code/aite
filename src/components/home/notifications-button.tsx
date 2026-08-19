import Link from 'next/link';
import { useAuth } from '@lib/context/auth-context';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';

export function NotificationsButton(): JSX.Element {
  const { unreadNotifications } = useAuth();
  const showBadge = typeof unreadNotifications === 'number' && unreadNotifications > 0;

  return (
    <Link href='/notifications'>
      <a
        className='dark-bg-tab group relative p-2 hover:bg-light-primary/10
                   active:bg-light-primary/20 dark:hover:bg-dark-primary/10
                   dark:active:bg-dark-primary/20'
      >
        <span className='relative'>
          <HeroIcon className='h-7 w-7' iconName='BellIcon' />
          {showBadge && (
            <span
              className='absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center
                         rounded-full bg-main-accent px-1 text-[10px] font-bold text-black'
            >
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </span>
        <ToolTip tip='التنبيهات' />
      </a>
    </Link>
  );
}
