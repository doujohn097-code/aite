import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from '@headlessui/react';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { SettingsModal } from '@components/modal/settings-modal';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { CustomIcon } from '@components/ui/custom-icon';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { variants } from './more-settings';
import type { User } from '@lib/types/user';

export function SidebarProfile(): JSX.Element {
  const { user, signOut } = useAuth();
  const { t, isRtl } = useLanguage();
  const { open, openModal, closeModal } = useModal();
  const {
    open: settingsOpen,
    openModal: openSettingsModal,
    closeModal: closeSettingsModal
  } = useModal();

  const { name, username, verified, gender, photoURL } = user as User;

  return (
    <>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={open}
        closeModal={closeModal}
      >
        <ActionModal
          useIcon
          focusOnMainBtn
          title={t('profile.logoutTitle')}
          description={t('profile.logoutBody')}
          mainBtnLabel={t('action.logout')}
          action={signOut}
          closeModal={closeModal}
        />
      </Modal>
      <Modal
        modalClassName='max-w-md bg-main-background w-full p-6 rounded-2xl max-h-[85vh] overflow-y-auto'
        open={settingsOpen}
        closeModal={closeSettingsModal}
      >
        <SettingsModal closeModal={closeSettingsModal} />
      </Modal>
      <Menu className='relative' as='section'>
        {({ open }): JSX.Element => (
          <>
            <Menu.Button
              className={cn(
                `custom-button main-tab dark-bg-tab flex w-full items-center 
                 justify-between hover:bg-light-primary/10 active:bg-light-primary/20
                 dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20`,
                open && 'bg-light-primary/10 dark:bg-dark-primary/10'
              )}
            >
              <div className='flex gap-3 truncate'>
                <UserAvatar src={photoURL} alt={name} size={40} />
                <div className='hidden truncate text-start leading-5 xl:block'>
                  <UserName
                    name={name}
                    username={username}
                    verified={verified}
                    disableLink
                  />
                </div>
              </div>
              <HeroIcon
                className='hidden h-6 w-6 xl:block'
                iconName='EllipsisHorizontalIcon'
              />
            </Menu.Button>
            <AnimatePresence>
              {open && (
                <Menu.Items
                  className={`menu-container fixed bottom-20 z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl shadow-2xl xl:absolute xl:-top-36 xl:bottom-auto xl:w-full ${
                    isRtl
                      ? 'right-3 xl:right-0'
                      : 'left-3 xl:left-0'
                  }`}
                  as={motion.div}
                  {...variants}
                  static
                >
                  <Menu.Item
                    className='flex items-center justify-between gap-4 border-b 
                               border-light-border px-4 py-3 dark:border-dark-border'
                    as='div'
                    disabled
                  >
                    <div className='flex items-center gap-3 truncate'>
                      <UserAvatar src={photoURL} alt={name} />
                      <div className='truncate'>
                        <UserName
                          name={name}
                          username={username}
                          verified={verified}
                          disableLink
                        />
                      </div>
                    </div>
                    <i>
                      <HeroIcon
                        className='h-5 w-5 text-main-accent-text'
                        iconName='CheckIcon'
                      />
                    </i>
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }): JSX.Element => (
                      <Button
                        className={cn(
                          'flex w-full gap-3 rounded-none p-4',
                          active && 'bg-main-sidebar-background'
                        )}
                        onClick={openSettingsModal}
                      >
                        <HeroIcon iconName='Cog6ToothIcon' />
                        {t('settings.title')}
                      </Button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }): JSX.Element => (
                      <Button
                        className={cn(
                          'flex w-full gap-3 rounded-md rounded-t-none p-4',
                          active && 'bg-main-sidebar-background'
                        )}
                        onClick={openModal}
                      >
                        <HeroIcon iconName='ArrowRightOnRectangleIcon' />
                        {t('action.logout')} @{username}
                      </Button>
                    )}
                  </Menu.Item>
                  <i
                    className='absolute -bottom-[10px] left-2 translate-x-1/2 rotate-180
                               [filter:drop-shadow(#cfd9de_1px_-1px_1px)] 
                               dark:[filter:drop-shadow(#333639_1px_-1px_1px)]
                               xl:left-1/2 xl:-translate-x-1/2'
                  >
                    <CustomIcon
                      className='h-4 w-6 fill-main-background'
                      iconName='TriangleIcon'
                    />
                  </i>
                </Menu.Items>
              )}
            </AnimatePresence>
          </>
        )}
      </Menu>
    </>
  );
}
