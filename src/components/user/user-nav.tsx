import { motion } from 'framer-motion';
import cn from 'clsx';
import { variants } from '@components/user/user-header';
import { UserNavLink } from './user-nav-link';

const followNavs = [
  { name: 'يتابع', path: 'following' },
  { name: 'المتابعون', path: 'followers' }
] as const;

export function UserNav(): JSX.Element {
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
