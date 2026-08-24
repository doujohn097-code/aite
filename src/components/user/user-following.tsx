import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';

type UserFollowingProps = {
  userTargetId: string;
};

export function UserFollowing({
  userTargetId
}: UserFollowingProps): JSX.Element | null {
  const { user } = useAuth();
  const { t } = useLanguage();

  const isOwner =
    user?.id !== userTargetId && user?.followers?.includes(userTargetId);

  if (!isOwner) return null;

  return (
    <p className='rounded bg-main-search-background px-1 text-xs'>
      {t('profile.followsYou')}
    </p>
  );
}
