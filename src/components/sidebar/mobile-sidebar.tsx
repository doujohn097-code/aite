import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { MobileSidebarModal } from '@components/modal/mobile-sidebar-modal';
import { HeroIcon } from '@components/ui/hero-icon';
import type { Variants } from 'framer-motion';
import type { User } from '@lib/types/user';

function drawerVariant(isRtl: boolean): Variants {
  const offscreen = isRtl ? '102%' : '-102%';
  return {
    initial: { x: offscreen },
    animate: {
      x: 0,
      transition: {
        type: 'spring',
        damping: 34,
        stiffness: 340,
        mass: 0.9,
        restDelta: 0.4
      }
    },
    exit: {
      x: offscreen,
      transition: {
        duration: 0.3,
        ease: [0.32, 0.72, 0, 1]
      }
    }
  };
}

export function MobileSidebar(): JSX.Element {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const { open, openModal, closeModal } = useModal();

  return (
    <>
      <Modal
        className='fixed inset-0 overflow-hidden p-0'
        modalAnimation={drawerVariant(isRtl)}
        modalClassName={`!absolute !inset-y-0 h-app max-h-app w-[86vw] max-w-[340px]
                        overflow-hidden bg-main-background
                        shadow-[0_0_60px_rgba(0,0,0,0.45)] flex flex-col ${
                          isRtl
                            ? '!right-0 rounded-l-[28px] border-l border-light-border/70 dark:border-dark-border/70'
                            : '!left-0 rounded-r-[28px] border-r border-light-border/70 dark:border-dark-border/70'
                        }`}
        open={open}
        closeModal={closeModal}
      >
        <MobileSidebarModal {...(user as User)} closeModal={closeModal} />
      </Modal>
      <button
        type='button'
        onClick={openModal}
        aria-label={t('nav.more')}
        className='dark-bg-tab xs:hidden rounded-full p-2 text-light-primary
                   hover:bg-light-primary/10 active:bg-light-primary/20
                   dark:text-dark-primary dark:hover:bg-dark-primary/10
                   dark:active:bg-dark-primary/20'
      >
        <HeroIcon className='h-7 w-7' iconName='Bars3Icon' />
      </button>
    </>
  );
}
