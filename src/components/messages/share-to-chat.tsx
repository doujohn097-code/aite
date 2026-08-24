import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { getOrCreateConversation, sendMessage } from '@lib/messages';
import { Modal } from '@components/modal/modal';
import { HeroIcon } from '@components/ui/hero-icon';
import { NewMessageModal } from './new-message-modal';
import type { SharedPostRef } from '@lib/types/message';
import { useLanguage } from '@lib/context/language-context';
import { tx } from '@lib/i18n/tx';

/** Bottom-sheet composer shared by posts and reels. */
export function useShareToChat(shared: SharedPostRef): {
  openShare: () => void;
  element: JSX.Element;
} {
  const { user } = useAuth();
  const { t } = useLanguage();
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
      toast.success(t('ok.linkCopied'));
    } catch {
      toast.error(t('reels.linkCopyFail'));
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
        sent === 1 ? t('ok.sentChat') : t('ok.sentMany', { n: sent })
      );
    else if (sent && failed)
      toast.success(t('ok.sentPartial', { sent, failed }));
    else toast.error(t('err.shareFail'));
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
          <p className='font-bold'>{t('chat.sendTo')}</p>
          <p className='text-xs text-light-secondary dark:text-dark-secondary'>
            {t('chat.sendKindHint', {
              kind:
                shared.kind === 'reel' ? t('messages.reel') : t('messages.post')
            })}
          </p>
        </div>
        <button
          type='button'
          onClick={() => void copyLink()}
          className='flex items-center gap-2 rounded-full bg-main-accent/15 px-3 py-2 text-sm font-bold text-main-accent-text transition hover:bg-main-accent/25'
        >
          <HeroIcon className='h-4 w-4' iconName='LinkIcon' /> {t('chat.copyLink')}
        </button>
      </div>
      <NewMessageModal
        multiSelect
        title={t('chat.pickRecipients')}
        closeModal={() => setOpen(false)}
        onSelect={(target) => void handleSelectMany([target])}
        onSelectMany={(targets) => void handleSelectMany(targets)}
      />
    </Modal>
  );
  return { openShare, element };
}
