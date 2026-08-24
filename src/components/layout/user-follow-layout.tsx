import { motion } from 'framer-motion';
import { useUser } from '@lib/context/user-context';
import { UserFeedSkeleton } from '@components/ui/skeleton';
import { UserNav } from '@components/user/user-nav';
import { variants } from '@components/user/user-header';
import type { LayoutProps } from './common-layout';

export function UserFollowLayout({ children }: LayoutProps): JSX.Element {
  const { user: userData, loading } = useUser();

  return (
    <>
      {!userData ? (
        <motion.section {...variants}>
          {loading ? (
            <UserFeedSkeleton count={4} />
          ) : (
            <div className='w-full p-8 text-center'>
              <p className='text-3xl font-bold'>هذا الحساب غير موجود</p>
              <p className='text-light-secondary dark:text-dark-secondary'>
                جرب البحث عن حساب آخر.
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
