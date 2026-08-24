import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { query, where, Timestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { useAuth } from '@lib/context/auth-context';
import { usersCollection } from '@lib/firebase/collections';
import { useCollection } from '@lib/hooks/useCollection';
import { getTimestampMillis } from '@lib/date';
import { StoryChipSkeleton } from '@components/ui/skeleton';
import { StoryAvatar } from './story-avatar';
import { StoryEditor } from './story-editor';

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function StoriesBar(): JSX.Element {
  const { user: currentUser } = useAuth();
  const { push } = useRouter();

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const usersQuery = useMemo(() => {
    const oneDayAgo = Timestamp.fromMillis(Date.now() - STORY_LIFETIME_MS);
    return query(usersCollection, where('lastStoryAt', '>', oneDayAgo));
  }, []);

  const { data: allUsers, loading } = useCollection(usersQuery, {
    allowNull: true
  });

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
      <StoryEditor
        open={createModalOpen}
        closeModal={(): void => setCreateModalOpen(false)}
      />
      <motion.section
        className='glass-panel flex gap-4 overflow-x-auto border-b border-light-border
                   px-4 py-3 dark:border-dark-border'
      >
        {currentUser && (
          <div className='flex shrink-0 flex-col items-center gap-1'>
            <button
              type='button'
              onClick={openCreateModal}
              className='relative flex h-14 w-14 items-center justify-center rounded-full
                         border-2 border-dashed border-main-accent bg-main-background
                         text-main-accent-text transition hover:bg-main-accent/10'
            >
              <span className='text-2xl leading-none'>+</span>
            </button>
            <span className='max-w-[4rem] truncate text-xs'>قصتك</span>
          </div>
        )}

        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <StoryChipSkeleton key={i} />
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
