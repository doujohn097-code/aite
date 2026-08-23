import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { MobileSidebarModal } from '@components/modal/mobile-sidebar-modal';
import { StoryAvatar } from '@components/stories/story-avatar';
import type { Variants } from 'framer-motion';
import type { User } from '@lib/types/user';

/** انزلاق حريري من حافة الشاشة مع ارتداد خفيف عند الاستقرار */
const drawerVariant: Variants = {
  initial: { x: '102%' },
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
    x: '102%',
    transition: {
      duration: 0.3,
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
        className='fixed inset-0 overflow-hidden p-0'
        modalAnimation={drawerVariant}
        modalClassName='!absolute !inset-y-0 !right-0 h-app max-h-app w-[86vw] max-w-[340px]
                        overflow-hidden rounded-l-[28px] border-l border-light-border/70
                        bg-main-background shadow-[0_0_60px_rgba(0,0,0,0.45)]
                        dark:border-dark-border/70 flex flex-col'
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
