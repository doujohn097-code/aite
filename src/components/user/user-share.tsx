import cn from 'clsx';
import { Popover } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { preventBubbling } from '@lib/utils';
import { siteURL } from '@lib/env';
import { useAuth } from '@lib/context/auth-context';
import { manageBlock } from '@lib/firebase/utils';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { variants } from '@components/tweet/tweet-actions';
import { useLanguage } from '@lib/context/language-context';

type UserShareProps = {
  username: string;
  userId?: string;
};

export function UserShare({ username, userId }: UserShareProps): JSX.Element {
  const { t } = useLanguage();

  const { user } = useAuth();
  const isBlocked = !!userId && user?.blockedUsers?.includes(userId);
  const handleBlock = async (closeMenu: () => void): Promise<void> => {
    if (!user || !userId || user.id === userId) return;
    await manageBlock(isBlocked ? 'unblock' : 'block', user.id, userId);
    closeMenu();
    toast.success(
      isBlocked ? t('ok.unblockedUser', { username }) : t('ok.blockedUser', { username })
    );
  };
  const handleCopy = (closeMenu: () => void) => async (): Promise<void> => {
    closeMenu();
    await navigator.clipboard.writeText(`${siteURL}/user/${username}`);
    toast.success(t('ok.linkCopied'));
  };

  return (
    <Popover className='relative'>
      {({ open, close }): JSX.Element => (
        <>
          <Popover.Button
            as={Button}
            className={cn(
              `dark-bg-tab group relative border border-light-line-reply p-2
               hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
               dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20`,
              open && 'bg-light-primary/10 dark:bg-dark-primary/10'
            )}
          >
            <HeroIcon className='h-5 w-5' iconName='EllipsisHorizontalIcon' />
            {!open && <ToolTip tip={t('common.more')} />}
          </Popover.Button>
          <AnimatePresence>
            {open && (
              <Popover.Panel
                className='menu-container group absolute left-0 top-11 w-max max-w-xs
                           break-words text-light-primary dark:text-dark-primary'
                as={motion.div}
                {...variants}
                static
              >
                <Popover.Button
                  className='flex w-full gap-3 rounded-md rounded-b-none p-4 hover:bg-main-sidebar-background'
                  as={Button}
                  onClick={preventBubbling(handleCopy(close))}
                >
                  <HeroIcon iconName='LinkIcon' />
                  {t('profile.copyLink')}
                </Popover.Button>
                {userId && user?.id !== userId && (
                  <Popover.Button
                    className='flex w-full gap-3 border-t border-light-border p-4 text-accent-red hover:bg-accent-red/10 dark:border-dark-border'
                    as={Button}
                    onClick={preventBubbling(() => handleBlock(close))}
                  >
                    <HeroIcon
                      iconName={isBlocked ? 'CheckCircleIcon' : 'NoSymbolIcon'}
                    />
                    {isBlocked ? t('profile.unblockUser', { username }) : t('profile.blockUser', { username })}
                  </Popover.Button>
                )}
              </Popover.Panel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
}
