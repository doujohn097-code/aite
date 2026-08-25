import { toast } from 'react-hot-toast';
import { preventBubbling } from '@lib/utils';
import { siteURL } from '@lib/env';
import { Button } from '@components/ui/button';
import { OverflowMenu } from '@components/ui/overflow-menu';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { useShareToChat } from '@components/messages/share-to-chat';
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

  return (
    <>
      <OverflowMenu
        aria-label={t('action.share')}
        buttonClassName='group relative flex w-full items-center justify-center gap-1 p-0 outline-none
                         transition-none hover:text-accent-blue focus-visible:text-accent-blue'
        button={
          <i
            className='relative rounded-full p-2 not-italic duration-200 group-hover:bg-accent-blue/10
                       group-focus-visible:bg-accent-blue/10 group-focus-visible:ring-2
                       group-focus-visible:ring-accent-blue/80 group-active:bg-accent-blue/20'
          >
            <HeroIcon
              className={viewTweet ? 'h-6 w-6' : 'h-5 w-5'}
              iconName='ArrowUpTrayIcon'
            />
            <ToolTip tip={t('action.share')} />
          </i>
        }
      >
        {(close): JSX.Element => (
          <>
            <Button
              className='accent-tab flex w-full justify-start gap-3 rounded-none p-4 hover:bg-main-sidebar-background'
              onClick={preventBubbling(() => {
                close();
                openShare();
              })}
            >
              <HeroIcon iconName='PaperAirplaneIcon' />
              {t('tweet.sendMsg')}
            </Button>
            <Button
              className='accent-tab flex w-full justify-start gap-3 rounded-none p-4 hover:bg-main-sidebar-background'
              onClick={preventBubbling(async () => {
                close();
                await navigator.clipboard.writeText(
                  `${siteURL}/tweet/${tweetId}`
                );
                toast.success(t('ok.linkCopied'));
              })}
            >
              <HeroIcon iconName='LinkIcon' />
              {t('tweet.copyLink')}
            </Button>
          </>
        )}
      </OverflowMenu>
      {element}
    </>
  );
}
