import { query, where } from 'firebase/firestore';
import { useUser } from '@lib/context/user-context';
import { useMergedCollection } from '@lib/dual';
import { collectionsFor } from '@lib/firebase/collections';
import { SEO } from '@components/common/seo';
import { UserCards } from '@components/user/user-cards';
import type { User } from '@lib/types/user';

type UserFollowProps = {
  type: 'following' | 'followers';
};

export function UserFollow({ type }: UserFollowProps): JSX.Element {
  const { user } = useUser();
  const { name, username } = user as User;

  const followQueryA = user?.id
    ? query(
        collectionsFor('a').users,
        where(
          type === 'following' ? 'followers' : 'following',
          'array-contains',
          user.id
        )
      )
    : null;
  const followQueryB = user?.id
    ? query(
        collectionsFor('b').users,
        where(
          type === 'following' ? 'followers' : 'following',
          'array-contains',
          user.id
        )
      )
    : null;

  const { data, loading } = useMergedCollection(followQueryA, followQueryB, {
    allowNull: true,
    disabled: !user?.id
  });

  return (
    <>
      <SEO
        title={`${
          type === 'following' ? 'متابعون يتابعهم' : 'متابعون'
        } ${name} (@${username}) / Aite`}
      />
      <UserCards follow data={data} type={type} loading={loading} />
    </>
  );
}
