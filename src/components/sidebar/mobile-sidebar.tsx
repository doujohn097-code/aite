import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { MobileSidebarModal } from '@components/modal/mobile-sidebar-modal';
import { StoryAvatar } from '@components/stories/story-avatar';
import type { Variants } from 'framer-motion';
import type { User } from '@lib/types/user';

const drawerVariant: Variants = {
  initial: { x: '-100%', opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 28,
      stiffness: 280,
      mass: 0.85
    }
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: {
      duration: 0.22,
      ease: [0.32, 0.72, 0, 1]
    }
  }
};

export function MobileSidebar(): JSX.Element {
  const { user } = useAuth();
  const { open, openModal, closeModal } = useModal();

  return (
    <>
      <Modal
        className='flex justify-start overflow-hidden p-0'
        modalAnimation={drawerVariant}
        modalClassName='h-[100dvh] max-h-[100dvh] w-[86vw] max-w-[340px] bg-main-background shadow-2xl rounded-r-[28px] border-r border-light-border/80 dark:border-dark-border/80 overflow-hidden flex flex-col'
        open={open}
        closeModal={closeModal}
      >
        <MobileSidebarModal {...(user as User)} closeModal={closeModal} />
      </Modal>
      <StoryAvatar
        className='xs:hidden'
        user={user as User}
        size={38}
        onClick={openModal}
      />
    </>
  );
}
