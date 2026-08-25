import { toast } from 'react-hot-toast';
import { preventBubbling } from '@lib/utils';
import { siteURL } from '@lib/env';
import { useAuth } from '@lib/context/auth-context';
import { manageBlock } from '@lib/firebase/utils';
import { Button } from '@components/ui/button';
import { OverflowMenu } from '@components/ui/overflow-menu';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
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
      isBlocked
        ? t('ok.unblockedUser', { username })
        : t('ok.blockedUser', { username })
    );
  };
  const handleCopy = (closeMenu: () => void) => async (): Promise<void> => {
    closeMenu();
    await navigator.clipboard.writeText(`${siteURL}/user/${username}`);
    toast.success(t('ok.linkCopied'));
  };

  return (
    <OverflowMenu
      aria-label={t('common.more')}
      buttonClassName='dark-bg-tab group relative rounded-full border border-light-line-reply p-2
                       hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
      button={
        <div className='group relative'>
          <HeroIcon className='h-5 w-5' iconName='EllipsisHorizontalIcon' />
          <ToolTip tip={t('common.more')} />
        </div>
      }
    >
      {(close): JSX.Element => (
        <>
          <Button
            className='flex w-full justify-start gap-3 rounded-none p-4 hover:bg-main-sidebar-background'
            onClick={preventBubbling(handleCopy(close))}
          >
            <HeroIcon iconName='LinkIcon' />
            {t('profile.copyLink')}
          </Button>
          {userId && user?.id !== userId && (
            <Button
              className='flex w-full justify-start gap-3 border-t border-light-border p-4 text-accent-red hover:bg-accent-red/10 dark:border-dark-border'
              onClick={preventBubbling(() => handleBlock(close))}
            >
              <HeroIcon
                iconName={isBlocked ? 'CheckCircleIcon' : 'NoSymbolIcon'}
              />
              {isBlocked
                ? t('profile.unblockUser', { username })
                : t('profile.blockUser', { username })}
            </Button>
          )}
        </>
      )}
    </OverflowMenu>
  );
}
