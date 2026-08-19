import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { getOrCreateConversation, sendMessage } from '@lib/messages';
import { Modal } from '@components/modal/modal';
import { NewMessageModal } from './new-message-modal';
import type { SharedPostRef } from '@lib/types/message';

/** هوك مشاركة منشور/ريل عبر الرسائل — يفتح منتقياً لاختيار الشخص */
export function useShareToChat(shared: SharedPostRef): {
  openShare: () => void;
  element: JSX.Element;
} {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const openShare = (): void => {
    if (!user) return;
    setOpen(true);
  };

  const handleSelect = async (targetUserId: string): Promise<void> => {
    if (!user) return;
    try {
      const conversation = await getOrCreateConversation(user.id, targetUserId);
      await sendMessage(conversation, user.id, {
        type: 'shared',
        post: shared
      });
      toast.success('تمت المشاركة عبر الرسائل');
    } catch {
      toast.error('تعذرت المشاركة — حاول مرة أخرى');
    }
  };

  const element = (
    <Modal
      className='flex items-start justify-center'
      modalClassName='bg-main-background rounded-2xl max-w-md w-full mt-8 overflow-hidden'
      open={open}
      closeModal={() => setOpen(false)}
    >
      <NewMessageModal
        closeModal={() => setOpen(false)}
        onSelect={(target) => void handleSelect(target.id)}
      />
    </Modal>
  );

  return { openShare, element };
}
