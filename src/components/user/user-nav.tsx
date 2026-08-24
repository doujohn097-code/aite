import { motion } from 'framer-motion';
import cn from 'clsx';
import { useLanguage } from '@lib/context/language-context';
import { variants } from '@components/user/user-header';
import { UserNavLink } from './user-nav-link';

export function UserNav(): JSX.Element {
  const { t } = useLanguage();
  const followNavs = [
    { name: t('profile.following'), path: 'following' },
    { name: t('profile.followersTab'), path: 'followers' }
  ] as const;

  return (
    <motion.nav
      className={cn(
        `hover-animation flex justify-between overflow-y-auto
         border-b border-light-border dark:border-dark-border`
      )}
      {...variants}
      exit={undefined}
    >
      {followNavs.map(({ name, path }) => (
        <UserNavLink name={name} path={path} key={name} />
      ))}
    </motion.nav>
  );
}
