import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { query, where, Timestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { useAuth } from '@lib/context/auth-context';
import { collectionsFor } from '@lib/firebase/collections';
import { useMergedCollection } from '@lib/dual';
import { getTimestampMillis } from '@lib/date';
import { StoryAvatar } from './story-avatar';
import { CreateStoryModal } from './create-story-modal';

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function StoriesBar(): JSX.Element {
  const { user: currentUser } = useAuth();
  const { push } = useRouter();

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const makeUsersQuery = (project: 'a' | 'b') => {
    const oneDayAgo = Timestamp.fromMillis(Date.now() - STORY_LIFETIME_MS);
    return query(
      collectionsFor(project).users,
      where('lastStoryAt', '>', oneDayAgo)
    );
  };

  const usersQueryA = useMemo(() => makeUsersQuery('a'), []);
  const usersQueryB = useMemo(() => makeUsersQuery('b'), []);

  const fallbackStories = {
    collection: 'users' as const,
    where: {
      field: 'lastStoryAt',
      op: '>' as const,
      value: new Date(Date.now() - STORY_LIFETIME_MS).toISOString()
    },
    orderBy: { field: 'lastStoryAt', dir: 'desc' as const },
    limit: 50
  };
  const { data: allUsers, loading } = useMergedCollection(
    usersQueryA,
    usersQueryB,
    { allowNull: true, fallback: { a: fallbackStories, b: fallbackStories } }
  );

  const users = useMemo(() => {
    if (!allUsers) return [];
    const following = new Set(currentUser?.following ?? []);
    return allUsers
      .filter((u) => u.id === currentUser?.id || following.has(u.id))
      .sort(
        (a, b) =>
          getTimestampMillis(b.lastStoryAt) - getTimestampMillis(a.lastStoryAt)
      );
  }, [allUsers, currentUser]);

  // The stories bar reflects real (24h) stories only. Reels do not bump
  // lastStoryAt, so reel-only users never appear here.
  const storyUsers = users;

  const openCreateModal = (): void => setCreateModalOpen(true);

  const viewUserStories = (userId: string): void => {
    void push(`/stories/${userId}`);
  };

  return (
    <>
      <CreateStoryModal
        open={createModalOpen}
        closeModal={(): void => setCreateModalOpen(false)}
      />
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className='flex gap-4 overflow-x-auto border-b border-light-border
                   px-4 py-3 dark:border-dark-border'
      >
        {currentUser && (
          <div className='flex shrink-0 flex-col items-center gap-1'>
            <button
              type='button'
              onClick={openCreateModal}
              className='relative flex h-14 w-14 items-center justify-center rounded-full
                         border-2 border-dashed border-main-accent bg-main-background
                         text-main-accent transition hover:bg-main-accent/10'
            >
              <span className='text-2xl leading-none'>+</span>
            </button>
            <span className='max-w-[4rem] truncate text-xs'>قصتك</span>
          </div>
        )}

        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='flex shrink-0 flex-col items-center gap-1'>
              <div className='h-14 w-14 animate-pulse rounded-full bg-light-line-reply dark:bg-dark-line-reply' />
              <div className='h-3 w-10 animate-pulse rounded bg-light-line-reply dark:bg-dark-line-reply' />
            </div>
          ))}

        {storyUsers.map((user) => (
          <div
            key={user.id}
            className='flex shrink-0 flex-col items-center gap-1'
          >
            <StoryAvatar
              user={user}
              size={56}
              onClick={(): void => viewUserStories(user.id)}
            />
            <span className='max-w-[4rem] truncate text-xs'>{user.name}</span>
          </div>
        ))}
      </motion.section>
    </>
  );
}
