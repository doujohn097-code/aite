import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { getOrCreateConversation, sendMessage } from '@lib/messages';
import { Modal } from '@components/modal/modal';
import { HeroIcon } from '@components/ui/hero-icon';
import { NewMessageModal } from './new-message-modal';
import type { SharedPostRef } from '@lib/types/message';

/** Bottom-sheet composer shared by posts and reels. */
export function useShareToChat(shared: SharedPostRef): {
  openShare: () => void;
  element: JSX.Element;
} {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const openShare = (): void => {
    if (user) setOpen(true);
  };
  const url =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${
          shared.kind === 'reel' ? '/reels' : `/tweet/${shared.id}`
        }`;

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('تم نسخ الرابط');
    } catch {
      toast.error('تعذر نسخ الرابط');
    }
  };

  const handleSelect = async (targetUserId: string): Promise<void> => {
    if (!user) return;
    try {
      const conversation = await getOrCreateConversation(user.id, targetUserId);
      await sendMessage(conversation, user.id, {
        type: 'shared',
        post: shared
      });
      setOpen(false);
      toast.success('تم الإرسال عبر الرسائل');
    } catch {
      toast.error('تعذرت المشاركة — حاول مرة أخرى');
    }
  };

  const element = (
    <Modal
      className='flex items-end justify-center p-0'
      modalClassName='w-full max-w-xl rounded-t-[30px] border border-light-border bg-main-background shadow-2xl dark:border-dark-border'
      open={open}
      closeModal={() => setOpen(false)}
    >
      <div className='mx-auto mt-3 h-1.5 w-12 rounded-full bg-light-border dark:bg-dark-border' />
      <div className='flex items-center justify-between px-5 pb-3 pt-4'>
        <div>
          <p className='font-bold'>إرسال إلى</p>
          <p className='text-xs text-light-secondary dark:text-dark-secondary'>
            اختر شخصًا لإرسال {shared.kind === 'reel' ? 'الريل' : 'المنشور'}{' '}
            إليه
          </p>
        </div>
        <button
          type='button'
          onClick={() => void copyLink()}
          className='flex items-center gap-2 rounded-full bg-main-accent/15 px-3 py-2 text-sm font-bold text-main-accent transition hover:bg-main-accent/25'
        >
          <HeroIcon className='h-4 w-4' iconName='LinkIcon' /> نسخ الرابط
        </button>
      </div>
      <NewMessageModal
        closeModal={() => setOpen(false)}
        onSelect={(target) => void handleSelect(target.id)}
      />
    </Modal>
  );
  return { openShare, element };
}
