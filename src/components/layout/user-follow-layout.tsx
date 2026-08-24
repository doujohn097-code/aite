import { motion } from 'framer-motion';
import { useLanguage } from '@lib/context/language-context';
import { useUser } from '@lib/context/user-context';
import { UserFeedSkeleton } from '@components/ui/skeleton';
import { UserNav } from '@components/user/user-nav';
import { variants } from '@components/user/user-header';
import type { LayoutProps } from './common-layout';

export function UserFollowLayout({ children }: LayoutProps): JSX.Element {
  const { user: userData, loading } = useUser();
  const { t } = useLanguage();

  return (
    <>
      {!userData ? (
        <motion.section {...variants}>
          {loading ? (
            <UserFeedSkeleton count={4} />
          ) : (
            <div className='w-full p-8 text-center'>
              <p className='text-3xl font-bold'>{t('profile.notFound')}</p>
              <p className='text-light-secondary dark:text-dark-secondary'>
                {t('profile.notFoundHint')}
              </p>
            </div>
          )}
        </motion.section>
      ) : (
        <>
          <UserNav />
          {children}
        </>
      )}
    </>
  );
}
