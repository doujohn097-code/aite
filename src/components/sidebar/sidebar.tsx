import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';
import { useWindow } from '@lib/context/window-context';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { Input } from '@components/input/input';
import { CustomIcon } from '@components/ui/custom-icon';
import { Button } from '@components/ui/button';
import { SidebarLink } from './sidebar-link';
import { SidebarProfile } from './sidebar-profile';
import type { IconName } from '@components/ui/hero-icon';

export type NavLink = {
  href: string;
  linkName: string;
  iconName: IconName;
  disabled?: boolean;
  canBeHidden?: boolean;
};

const navLinks: Readonly<NavLink[]> = [
  {
    href: '/home',
    linkName: 'الرئيسية',
    iconName: 'HouseIcon'
  },
  {
    href: '/reels',
    linkName: 'الريلز',
    iconName: 'ClapperboardIcon'
  },
  {
    href: '/messages',
    linkName: 'الرسائل',
    iconName: 'MessengerIcon',
    disabled: true
  },
  {
    href: '/search',
    linkName: 'الأشخاص',
    iconName: 'UserGroupIcon'
  }
];

export function Sidebar(): JSX.Element {
  const { user } = useAuth();
  const { isMobile } = useWindow();
  const { asPath } = useRouter();

  const { open, openModal, closeModal } = useModal();

  const username = user?.username as string;
  const isReels = asPath.split('?')[0].startsWith('/reels');

  return (
    <header
      id='sidebar'
      className='order-last flex w-0 shrink-0 transition-opacity duration-200 xs:w-20 md:w-24
                 lg:max-w-none xl:w-full xl:max-w-xs xl:justify-start'
    >
      <Modal
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl max-w-xl w-full mt-8 overflow-hidden'
        open={open}
        closeModal={closeModal}
      >
        <Input modal closeModal={closeModal} />
      </Modal>
      <div
        className='fixed inset-x-0 bottom-0 z-50 flex w-full flex-col justify-between border-t border-light-border
                   bg-main-background/95 py-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-dark-border dark:bg-black/95
                   xs:inset-x-auto xs:top-0 xs:h-[100dvh] xs:w-auto xs:overflow-y-auto xs:overscroll-contain xs:border-0 xs:bg-transparent xs:px-2 xs:py-2
                   xs:[scrollbar-width:thin] md:px-4 xl:w-72'
      >
        <section className='flex flex-col justify-center gap-1 xs:items-center xl:items-stretch'>
          <h1 className='hidden xs:flex'>
            <Link href='/home'>
              <a
                className='custom-button main-tab transition hover:bg-light-primary/10 
                           focus-visible:!ring-main-accent/80 dark:hover:bg-dark-primary/10'
              >
                <CustomIcon className='h-8 w-8' iconName='AiteIcon' />
              </a>
            </Link>
          </h1>
          <nav className='flex items-center justify-around xs:flex-col xs:justify-center xl:block'>
            {navLinks.map(({ ...linkData }) => (
              <SidebarLink {...linkData} key={linkData.href} />
            ))}
            <SidebarLink
              href={`/user/${username}`}
              username={username}
              linkName='الملف الشخصي'
              iconName='UserIcon'
            />
          </nav>
          {!isReels && (
            <Button
              className='accent-tab absolute right-4 -translate-y-[72px] bg-main-accent text-lg font-bold text-black
                         outline-none transition hover:brightness-90 active:brightness-75 xs:static xs:translate-y-0
                         xs:hover:bg-main-accent/90 xs:active:bg-main-accent/75 xl:w-11/12'
              onClick={openModal}
            >
              <CustomIcon
                className='block h-6 w-6 xl:hidden'
                iconName='FeatherIcon'
              />
              <p className='hidden xl:block'>نشر</p>
            </Button>
          )}
        </section>
        {!isMobile && <SidebarProfile />}
      </div>
    </header>
  );
}
