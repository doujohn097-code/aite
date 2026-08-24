import { useRouter } from 'next/router';
import { doc } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { useDocument } from '@lib/hooks/useDocument';
import { useUser } from '@lib/context/user-context';
import { userStatsCollection } from '@lib/firebase/collections';
import { UserName } from './user-name';
import type { Variants } from 'framer-motion';
import { useLanguage } from '@lib/context/language-context';
import { resolveUsername } from '@lib/utils';

export const variants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } }
};

export function UserHeader(): JSX.Element {
  const { t } = useLanguage();

  const {
    pathname,
    query: { id }
  } = useRouter();

  const { user, loading } = useUser();

  const userId = user ? user.id : null;

  const { data: statsData, loading: statsLoading } = useDocument(
    doc(userStatsCollection(userId ?? 'null'), 'stats'),
    {
      allowNull: true,
      disabled: !userId
    }
  );

  const { tweets, likes } = statsData ?? {};

  const [totalTweets, totalPhotos, totalLikes] = [
    (user?.totalTweets ?? 0) + (tweets?.length ?? 0),
    user?.totalPhotos,
    likes?.length
  ];

  const currentPage = pathname.split('/').pop() ?? '';

  const isInTweetPage = ['[id]', 'with_replies'].includes(currentPage);
  const isInFollowPage = ['following', 'followers'].includes(currentPage);

  return (
    <AnimatePresence mode='popLayout'>
      {loading ? (
        <motion.div
          className='-mb-1 inner:animate-pulse inner:rounded-full
                     inner:bg-light-secondary/20 dark:inner:bg-dark-secondary/30'
          {...variants}
          key='loading'
        >
          <div className='-mt-1 mb-1 h-5 w-24' />
          <div className='h-3.5 w-12' />
        </motion.div>
      ) : !user ? (
        <motion.h2 className='text-xl font-bold' {...variants} key='not-found'>
          {typeof id === 'string' ? `@${id}` : t('profile.seoMissing')}
        </motion.h2>
      ) : (
        <motion.div
          className='-mb-1 flex flex-col items-end truncate text-right'
          {...variants}
          key='found'
        >
          <UserName
            tag='h2'
            name={user.name}
            className='-mt-1 text-xl'
            iconClassName='h-5 w-5'
            verified={user.verified}
          />
          <p className='text-xs text-light-secondary dark:text-dark-secondary'>
            {isInFollowPage || isInTweetPage
              ? resolveUsername(user)
                ? `@${resolveUsername(user)}`
                : t('common.user')
              : currentPage === 'media'
              ? totalPhotos
                ? `${totalPhotos} ${
                    totalPhotos > 1 ? t('profile.photosManyWord') : t('profile.photosOne')
                  }`
                : t('profile.noPhotos')
              : totalLikes
              ? `${totalLikes} ${totalLikes > 1 ? t('profile.followers') : t('action.like')}`
              : t('profile.noLikes')}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
