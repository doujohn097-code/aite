import { useLanguage } from '@lib/context/language-context';
import { MainHeader } from '@components/home/main-header';
import type { ReactNode } from 'react';
import type { StatsType } from '@components/view/view-tweet-stats';

type TweetStatsModalProps = {
  children: ReactNode;
  statsType: StatsType | null;
  handleClose: () => void;
};

export function TweetStatsModal({
  children,
  statsType,
  handleClose
}: TweetStatsModalProps): JSX.Element {
  const { t } = useLanguage();
  return (
    <>
      <MainHeader
        useActionButton
        disableSticky
        tip={t('common.close')}
        iconName='XMarkIcon'
        className='absolute flex w-full items-center gap-6 rounded-tl-2xl'
        title={
          statsType === 'likes' ? t('stats.likedBy') : t('stats.repostedBy')
        }
        action={handleClose}
      />
      {children}
    </>
  );
}
