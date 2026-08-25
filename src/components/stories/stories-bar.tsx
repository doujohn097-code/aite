import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { query, where, Timestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { useAuth } from '@lib/context/auth-context';
import { useLanguage } from '@lib/context/language-context';
import { usersCollection } from '@lib/firebase/collections';
import { useCollection } from '@lib/hooks/useCollection';
import { useStoryRing } from '@lib/hooks/useStoryRing';
import { getTimestampMillis } from '@lib/date';
import { StoryChipSkeleton } from '@components/ui/skeleton';
import { StoryAvatar } from './story-avatar';
import { STORY_LIFETIME_MS } from '@lib/story-lifetime';
import { StoryEditor } from './story-editor';

const CHIP = 56;

export function StoriesBar(): JSX.Element {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const { push } = useRouter();
  const ownRing = useStoryRing(currentUser);

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const usersQuery = useMemo(() => {
    const oneDayAgo = Timestamp.fromMillis(Date.now() - STORY_LIFETIME_MS);
    return query(usersCollection, where('lastStoryAt', '>', oneDayAgo));
  }, []);

  const { data: allUsers, loading } = useCollection(usersQuery, {
    allowNull: true
  });

  const storyUsers = useMemo(() => {
    if (!allUsers) return [];
    const following = new Set(currentUser?.following ?? []);
    return allUsers
      .filter((u) => u.id !== currentUser?.id && following.has(u.id))
      .sort(
        (a, b) =>
          getTimestampMillis(b.lastStoryAt) - getTimestampMillis(a.lastStoryAt)
      );
  }, [allUsers, currentUser]);

  const openCreateModal = (): void => setCreateModalOpen(true);

  const viewUserStories = (userId: string): void => {
    void push(`/stories/${userId}`);
  };

  const openOwn = (): void => {
    if (ownRing.hasStory && currentUser)
      void push(`/stories/${currentUser.id}`);
    else openCreateModal();
  };

  return (
    <>
      <StoryEditor
        open={createModalOpen}
        closeModal={(): void => setCreateModalOpen(false)}
      />
      <motion.section className='stories-bar flex items-start gap-3.5 overflow-x-auto px-3 py-2.5'>
        {currentUser && (
          <div className='flex w-14 shrink-0 flex-col items-center gap-1'>
            <div className='relative'>
              <StoryAvatar user={currentUser} size={CHIP} onClick={openOwn} />
              <button
                type='button'
                onClick={openCreateModal}
                aria-label={t('stories.create')}
                className='absolute -bottom-0.5 start-0 z-10 flex h-[18px] w-[18px] items-center
                           justify-center rounded-full bg-main-accent text-[13px] font-black
                           leading-none text-main-accent-contrast ring-2 ring-main-background'
              >
                +
              </button>
            </div>
            <span className='w-full truncate text-center text-[11px] leading-tight'>
              {t('stories.yours')}
            </span>
          </div>
        )}

        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <StoryChipSkeleton key={i} />
          ))}

        {storyUsers.map((user) => (
          <div
            key={user.id}
            className='flex w-14 shrink-0 flex-col items-center gap-1'
          >
            <StoryAvatar
              user={user}
              size={CHIP}
              onClick={(): void => viewUserStories(user.id)}
            />
            <span className='w-full truncate text-center text-[11px] leading-tight'>
              {user.name?.trim() || user.username || t('common.user')}
            </span>
          </div>
        ))}
      </motion.section>
    </>
  );
}
