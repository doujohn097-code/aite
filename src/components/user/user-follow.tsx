import { query, where } from 'firebase/firestore';
import { useLanguage } from '@lib/context/language-context';
import { useUser } from '@lib/context/user-context';
import { useCollection } from '@lib/hooks/useCollection';
import { usersCollection } from '@lib/firebase/collections';
import { SEO } from '@components/common/seo';
import { UserCards } from '@components/user/user-cards';
import type { User } from '@lib/types/user';

type UserFollowProps = {
  type: 'following' | 'followers';
};

export function UserFollow({ type }: UserFollowProps): JSX.Element {
  const { user } = useUser();
  const { t } = useLanguage();
  const { name, username } = user as User;

  const followQuery = user?.id
    ? query(
        usersCollection,
        where(
          type === 'following' ? 'followers' : 'following',
          'array-contains',
          user.id
        )
      )
    : null;

  const { data, loading } = useCollection(followQuery, {
    allowNull: true,
    disabled: !user?.id
  });

  return (
    <>
      <SEO
        title={
          type === 'following'
            ? t('profile.seoFollowing', { name, username })
            : t('profile.seoFollowers', { name, username })
        }
      />
      <UserCards follow data={data} type={type} loading={loading} />
    </>
  );
}
