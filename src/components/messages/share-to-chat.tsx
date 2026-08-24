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

  const handleSelectMany = async (
    targets: { id: string }[]
  ): Promise<void> => {
    if (!user || !targets.length) return;
    const results = await Promise.allSettled(
      targets.map(async (target) => {
        const conversation = await getOrCreateConversation(user.id, target.id);
        await sendMessage(conversation, user.id, {
          type: 'shared',
          post: shared
        });
      })
    );
    const sent = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - sent;
    setOpen(false);
    if (sent && !failed)
      toast.success(
        sent === 1 ? 'تم الإرسال عبر الرسائل' : `تم الإرسال إلى ${sent} أشخاص`
      );
    else if (sent && failed)
      toast.success(`تم الإرسال إلى ${sent}، وتعذّر ${failed}`);
    else toast.error('تعذرت المشاركة — حاول مرة أخرى');
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
            يمكنك اختيار أكثر من شخص لإرسال{' '}
            {shared.kind === 'reel' ? 'الريل' : 'المنشور'}
          </p>
        </div>
        <button
          type='button'
          onClick={() => void copyLink()}
          className='flex items-center gap-2 rounded-full bg-main-accent/15 px-3 py-2 text-sm font-bold text-main-accent-text transition hover:bg-main-accent/25'
        >
          <HeroIcon className='h-4 w-4' iconName='LinkIcon' /> نسخ الرابط
        </button>
      </div>
      <NewMessageModal
        multiSelect
        title='اختر المستلمين'
        closeModal={() => setOpen(false)}
        onSelect={(target) => void handleSelectMany([target])}
        onSelectMany={(targets) => void handleSelectMany(targets)}
      />
    </Modal>
  );
  return { openShare, element };
}
