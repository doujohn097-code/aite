import cn from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@lib/context/language-context';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Loading } from '@components/ui/loading';
import { variants } from '@components/user/user-header';
import { UserCard } from './user-card';
import type { User } from '@lib/types/user';
import type { StatsType } from '@components/view/view-tweet-stats';
import type { StatsEmptyProps } from '@components/tweet/stats-empty';

type FollowType = 'following' | 'followers';

type CombinedTypes = StatsType | FollowType;

type UserCardsProps = {
  data: User[] | null;
  type: CombinedTypes;
  follow?: boolean;
  loading: boolean;
};

export function UserCards({
  data,
  type,
  follow,
  loading
}: UserCardsProps): JSX.Element {
  const { t } = useLanguage();
  const allNoStatsData: Record<CombinedTypes, StatsEmptyProps> = {
    retweets: {
      title: t('cards.repostsTitle'),
      imageData: { src: '/assets/no-retweets.png', alt: t('cards.repostsAlt') },
      description: t('cards.repostsDesc')
    },
    likes: {
      title: t('cards.likesTitle'),
      imageData: { src: '/assets/no-likes.png', alt: t('cards.likesAlt') },
      description: t('cards.likesDesc')
    },
    following: {
      title: t('cards.followTitle'),
      description: t('cards.followDesc')
    },
    followers: {
      title: t('cards.followersTitle'),
      imageData: {
        src: '/assets/no-followers.png',
        alt: t('cards.followersAlt')
      },
      description: t('cards.followersDesc')
    }
  };

  const noStatsData = allNoStatsData[type];
  const modal = ['retweets', 'likes'].includes(type);

  return (
    <section
      className={cn(
        modal && 'h-full overflow-y-auto [&>div:first-child>a]:mt-[52px]',
        loading && 'flex items-center justify-center'
      )}
    >
      {loading ? (
        <Loading className={modal ? 'mt-[52px]' : 'mt-5'} />
      ) : (
        <AnimatePresence mode='popLayout'>
          {data?.length ? (
            data.map((userData) => (
              <motion.div layout='position' key={userData.id} {...variants}>
                <UserCard {...userData} follow={follow} modal={modal} />
              </motion.div>
            ))
          ) : (
            <StatsEmpty {...noStatsData} modal={modal} />
          )}
        </AnimatePresence>
      )}
    </section>
  );
}
