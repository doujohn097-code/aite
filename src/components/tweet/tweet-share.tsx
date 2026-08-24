import cn from 'clsx';
import type { MouseEvent } from 'react';
import { Popover } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

import { preventBubbling } from '@lib/utils';
import { siteURL } from '@lib/env';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { useShareToChat } from '@components/messages/share-to-chat';
import { variants } from './tweet-actions';
import type { SharedPostRef } from '@lib/types/message';
import { useLanguage } from '@lib/context/language-context';

type TweetShareProps = {
  userId: string;
  tweetId: string;
  viewTweet?: boolean;
  /** بطاقة المنشور المشاركة عبر الرسائل */
  post?: SharedPostRef;
};

export function TweetShare({
  userId,
  tweetId,
  viewTweet,
  post
}: TweetShareProps): JSX.Element {
  const { t } = useLanguage();

  const { openShare, element } = useShareToChat(
    post ?? {
      id: tweetId,
      kind: 'tweet',
      authorName: null,
      authorUsername: null,
      authorPhoto: null,
      text: null,
      thumbnail: null
    }
  );

  const handleCopy = (closeMenu: () => void) => async (): Promise<void> => {
    closeMenu();
    await navigator.clipboard.writeText(`${siteURL}/tweet/${tweetId}`);
    toast.success(t('ok.linkCopied'));
  };

  return (
    <Popover className='relative'>
      {({ open, close }): JSX.Element => (
        <>
          <Popover.Button
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.preventDefault();
              openShare();
            }}
            className={cn(
              `group relative flex w-full items-center justify-center gap-1 p-0 outline-none
               transition-none hover:text-accent-blue focus-visible:text-accent-blue`,
              open && 'text-accent-blue inner:bg-accent-blue/10'
            )}
          >
            <i
              className='relative rounded-full p-2 not-italic duration-200 group-hover:bg-accent-blue/10 
                         group-focus-visible:bg-accent-blue/10 group-focus-visible:ring-2 
                         group-focus-visible:ring-accent-blue/80 group-active:bg-accent-blue/20'
            >
              <HeroIcon
                className={viewTweet ? 'h-6 w-6' : 'h-5 w-5'}
                iconName='ArrowUpTrayIcon'
              />
              {!open && <ToolTip tip={t('action.share')} />}
            </i>
          </Popover.Button>
          <AnimatePresence>
            {open && (
              <Popover.Panel
                className='menu-container group absolute left-0 top-11 w-max max-w-xs break-words text-light-primary dark:text-dark-primary'
                as={motion.div}
                {...variants}
                static
              >
                <Popover.Button
                  className='accent-tab flex w-full gap-3 rounded-md p-4 hover:bg-main-sidebar-background'
                  as={Button}
                  onClick={preventBubbling(() => {
                    close();
                    openShare();
                  })}
                >
                  <HeroIcon iconName='PaperAirplaneIcon' />
                  {t('tweet.sendMsg')}
                </Popover.Button>
                <Popover.Button
                  className='accent-tab flex w-full gap-3 rounded-md p-4 hover:bg-main-sidebar-background'
                  as={Button}
                  onClick={preventBubbling(handleCopy(close))}
                >
                  <HeroIcon iconName='LinkIcon' />
                  {t('tweet.copyLink')}
                </Popover.Button>
              </Popover.Panel>
            )}
          </AnimatePresence>
          {element}
        </>
      )}
    </Popover>
  );
}
