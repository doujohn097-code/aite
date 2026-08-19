import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, query, where, Timestamp, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { usersCollection, storiesCollection } from '@lib/firebase/collections';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
import { useModal } from '@lib/hooks/useModal';
import { getTimestampMillis } from '@lib/date';
import { viewStory, likeStory, deleteStory } from '@lib/firebase/utils';
import { UserAvatar } from '@components/user/user-avatar';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { CreateStoryModal } from './create-story-modal';
import type { Story } from '@lib/types/story';

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STORY_DURATION_MS = 15000;

export function StoryViewer({ userId }: { userId: string }): JSX.Element {
  const { back, push } = useRouter();
  const { user: authUser } = useAuth();
  const { open: confirmOpen, openModal: openConfirm, closeModal: closeConfirm } =
    useModal();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [touch, setTouch] = useState<{ x: number; t: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const userRef = doc(usersCollection, userId);
  const { data: userData, loading: userLoading } = useDocument(userRef, {
    allowNull: true
  });

  const storiesQuery = useMemo(
    () => query(storiesCollection, where('userId', '==', userId)),
    [userId]
  );

  const { data: rawStories, loading: storiesLoading } = useCollection(
    storiesQuery,
    { allowNull: true }
  );

  const stories = useMemo(() => {
    if (!rawStories) return [];
    const now = Date.now();
    return [...rawStories]
      .filter((s) => {
        if (s.kind === 'reel') return false;

        const createdMs = getTimestampMillis(s.createdAt);
        let expiresMs = getTimestampMillis(s.expiresAt);

        if (!expiresMs && createdMs) {
          expiresMs = createdMs + STORY_LIFETIME_MS;
        } else if (createdMs && expiresMs <= createdMs) {
          expiresMs = createdMs + STORY_LIFETIME_MS;
        }

        const isActive =
          expiresMs > now - 5 * 60 * 1000 ||
          (createdMs > 0 && now - createdMs < STORY_LIFETIME_MS);

        return isActive;
      })
      .sort(
        (a, b) =>
          getTimestampMillis(a.createdAt) - getTimestampMillis(b.createdAt)
      );
  }, [rawStories]);

  // Clean up ghost lastStoryAt if all stories expired or deleted
  useEffect(() => {
    if (!storiesLoading && rawStories && stories.length === 0 && userData?.lastStoryAt) {
      if (authUser?.id === userId) {
        void updateDoc(userRef, { lastStoryAt: null });
      }
    }
  }, [storiesLoading, rawStories, stories.length, userData?.lastStoryAt, authUser?.id, userId, userRef]);

  const activeUsersQuery = useMemo(() => {
    const oneDayAgo = Timestamp.fromMillis(Date.now() - STORY_LIFETIME_MS);
    return query(usersCollection, where('lastStoryAt', '>', oneDayAgo));
  }, []);

  const { data: activeUsersRaw } = useCollection(activeUsersQuery, {
    allowNull: true
  });

  const activeUsers = useMemo(() => {
    if (!activeUsersRaw || !authUser) return [];
    const following = new Set(authUser.following ?? []);
    return activeUsersRaw
      .filter((u) => u.id === authUser.id || following.has(u.id))
      .sort(
        (a, b) =>
          getTimestampMillis(b.lastStoryAt) - getTimestampMillis(a.lastStoryAt)
      );
  }, [activeUsersRaw, authUser]);

  const currentUserIndex = useMemo(
    () => activeUsers.findIndex((u) => u.id === userId),
    [activeUsers, userId]
  );

  const nextUserId = activeUsers[currentUserIndex + 1]?.id;
  const prevUserId = activeUsers[currentUserIndex - 1]?.id;

  useEffect(() => {
    if (stories.length && !stories[index]) setIndex(0);
  }, [stories, index]);

  const currentStory = stories[index];
  const currentStoryId = currentStory?.id;
  const isCurrentVideo = currentStory?.images?.[0]?.type?.startsWith('video/');

  const storyDuration = isCurrentVideo && currentStory?.duration
    ? currentStory.duration
    : Math.max(15000, currentStory?.duration ?? DEFAULT_STORY_DURATION_MS);

  const nextStory = useCallback((): void => {
    if (index < stories.length - 1) {
      setDirection(1);
      setIndex((i) => i + 1);
    } else if (nextUserId) {
      void push(`/stories/${nextUserId}`);
    } else void back();
  }, [index, stories.length, nextUserId, push, back]);

  const prevStory = useCallback((): void => {
    if (index > 0) {
      setDirection(-1);
      setIndex((i) => i - 1);
    } else if (prevUserId) {
      void push(`/stories/${prevUserId}`);
    } else void back();
  }, [index, prevUserId, push, back]);

  useEffect(() => {
    const story = stories.find((s) => s.id === currentStoryId);
    if (story && authUser && authUser.id !== userId)
      void viewStory(story.id, authUser.id, userId);
  }, [currentStoryId, authUser, userId, stories]);

  useEffect(() => {
    elapsedRef.current = 0;
    startTimeRef.current = null;
    setProgress(0);
  }, [currentStoryId, storyDuration]);

  useEffect(() => {
    if (!currentStory || paused) return;

    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      const elapsed =
        elapsedRef.current +
        (startTimeRef.current ? Date.now() - startTimeRef.current : 0);
      const pct = Math.min(100, (elapsed / storyDuration) * 100);
      setProgress(pct);
      if (elapsed >= storyDuration) {
        clearInterval(timer);
        nextStory();
      }
    }, 50);

    return () => {
      if (startTimeRef.current)
        elapsedRef.current += Date.now() - startTimeRef.current;
      clearInterval(timer);
    };
  }, [currentStoryId, storyDuration, paused, nextStory]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const music = currentStory?.music;
    if (music?.src) {
      audio.src = music.src;
      audio.loop = true;
      audio.muted = false;
      audio.volume = 0.8;
      void audio.play().catch(() => null);
    } else {
      audio.pause();
      audio.src = '';
    }
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [currentStoryId, currentStory?.music?.src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (paused) audio.pause();
    else if (audio.src && currentStory?.music?.src)
      void audio.play().catch(() => null);
  }, [paused, currentStory?.music?.src]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    setPaused(true);
    setTouch({ x: e.clientX, t: Date.now() });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!touch) {
      setPaused(false);
      return;
    }
    const diffX = e.clientX - touch.x;
    const diffT = Date.now() - touch.t;
    if (diffT < 500 && Math.abs(diffX) > 50) {
      if (diffX > 0) prevStory();
      else nextStory();
    } else {
      const width = (e.target as HTMLElement).clientWidth;
      const xRatio = e.clientX / width;
      if (xRatio < 0.35) nextStory();
      else if (xRatio > 0.65) prevStory();
    }
    setTouch(null);
    setPaused(false);
  };

  const isLiked = currentStory
    ? currentStory.likes.includes(authUser?.id ?? '')
    : false;

  const toggleLike = async (): Promise<void> => {
    if (!currentStory || !authUser) return;
    await likeStory(currentStory.id, authUser.id, userId, !isLiked);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!currentStory || !authUser || authUser.id !== userId) return;
    setIsDeleting(true);
    try {
      nextStory();
      await deleteStory(currentStory.id, authUser.id);
    } catch {
      toast.error('فشل حذف القصة');
    } finally {
      setIsDeleting(false);
      closeConfirm();
    }
  };

  const handleDeleteClick = (): void => openConfirm();

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0
    })
  };

  if (userLoading || storiesLoading)
    return (
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-black'>
        <Loading />
      </div>
    );

  if (!stories.length)
    return (
      <>
        <CreateStoryModal
          open={createModalOpen}
          closeModal={(): void => setCreateModalOpen(false)}
        />
        <div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6 text-center text-white'>
          <div className='mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10'>
            <HeroIcon className='h-10 w-10 text-main-accent' iconName='PhotoIcon' />
          </div>
          <h2 className='text-2xl font-bold'>
            {authUser?.id === userId
              ? 'لا توجد قصص نشطة في حسابك'
              : 'لا توجد قصص نشطة لهذا المستخدم'}
          </h2>
          <p className='mt-2 max-w-sm text-sm text-white/60'>
            {authUser?.id === userId
              ? 'شارك لحظاتك وصورك مع متابعيك، وستظهر هنا لمدة 24 ساعة.'
              : 'ربما انتهت صلاحية القصة أو تم حذفها مؤخراً.'}
          </p>
          <div className='mt-6 flex items-center gap-3'>
            {authUser?.id === userId && (
              <Button
                className='bg-main-accent px-5 py-2.5 font-bold text-black hover:bg-main-accent/90'
                onClick={(): void => setCreateModalOpen(true)}
              >
                + إنشاء قصة جديدة
              </Button>
            )}
            <Button
              className='bg-white/10 px-5 py-2.5 font-medium text-white hover:bg-white/20'
              onClick={(): void => void back()}
            >
              العودة للرئيسية
            </Button>
          </div>
        </div>
      </>
    );

  const user = userData ?? {
    name: 'مستخدم',
    username: 'unknown',
    photoURL: '/assets/default-avatar.png',
    verified: false
  };

  const currentMedia = currentStory?.images?.[0];
  const isVideo = currentMedia?.type?.startsWith('video/');

  return (
    <div className='fixed inset-0 z-50 flex flex-col bg-black'>
      <Modal
        open={confirmOpen}
        closeModal={closeConfirm}
        modalClassName='w-full max-w-sm rounded-2xl border border-white/20 bg-black/40 p-6 text-white backdrop-blur-xl'
      >
        <ActionModal
          title='حذف القصة؟'
          description='لن يمكن التراجع عن حذف هذه القصة.'
          mainBtnLabel='حذف'
          mainBtnClassName='bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/75'
          secondaryBtnLabel='إلغاء'
          action={confirmDelete}
          closeModal={closeConfirm}
          loading={isDeleting}
        />
      </Modal>

      <audio ref={audioRef} />

      <div className='absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-4'>
        {stories.map((_, i) => (
          <div key={i} className='h-0.5 flex-1 rounded-full bg-white/30'>
            <div
              className={cn(
                'h-full rounded-full bg-white',
                i < index && 'w-full',
                i === index && 'transition-none',
                i > index && 'w-0'
              )}
              style={
                i === index ? { width: `${progress}%` } : undefined
              }
            />
          </div>
        ))}
      </div>

      <header className='z-20 flex items-center justify-between px-4 pt-8 pb-2'>
        <div className='flex items-center gap-3'>
          <UserAvatar
            src={user.photoURL}
            alt={user.name}
            username={user.username}
            size={40}
          />
          <div className='flex flex-col text-white'>
            <span className='font-bold'>{user.name}</span>
            <span className='text-sm opacity-80'>@{user.username}</span>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {authUser?.id === userId && (
            <Button
              type='button'
              onClick={handleDeleteClick}
              className='bg-red-500/80 p-2 text-white hover:bg-red-500'
            >
              <HeroIcon className='h-5 w-5' iconName='TrashIcon' />
            </Button>
          )}
          <Button
            type='button'
            onClick={(): void => void back()}
            className='bg-white/10 p-2 text-white hover:bg-white/20'
          >
            <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
          </Button>
        </div>
      </header>

      <div
        className='relative flex flex-1 items-center justify-center overflow-hidden'
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <AnimatePresence initial={false} custom={direction} mode='popLayout'>
          {currentStory && (
            <motion.div
              key={currentStory.id}
              custom={direction}
              variants={slideVariants}
              initial='enter'
              animate='center'
              exit='exit'
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className='absolute inset-0 flex items-center justify-center'
            >
              {currentMedia &&
                (isVideo ? (
                  <video
                    src={currentMedia.src}
                    autoPlay
                    muted
                    playsInline
                    onEnded={nextStory}
                    className='max-h-full max-w-full object-contain'
                  />
                ) : (
                  <img
                    src={currentMedia.src}
                    alt={currentMedia.alt}
                    className='max-h-full max-w-full object-contain'
                  />
                ))}
              {currentStory.caption && (
                <div className='absolute bottom-24 left-4 right-4 rounded-xl bg-black/50 p-3 text-center text-white backdrop-blur-sm'>
                  {currentStory.caption}
                </div>
              )}
              {currentStory.music?.name && (
                <div className='absolute bottom-40 left-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur-sm'>
                  <HeroIcon className='h-4 w-4' iconName='MusicalNoteIcon' />
                  <span>{currentStory.music.name}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className='z-20 flex items-center justify-between px-4 py-4 text-white'>
        <Button
          type='button'
          onClick={toggleLike}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-2 transition',
            isLiked
              ? 'bg-red-500 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          )}
        >
          <HeroIcon
            className={cn('h-5 w-5', isLiked && 'fill-current')}
            iconName='HeartIcon'
          />
          <span>{currentStory?.likes.length ?? 0}</span>
        </Button>
        {authUser?.id === userId && (
          <div className='flex items-center gap-2 opacity-80'>
            <HeroIcon className='h-5 w-5' iconName='EyeIcon' />
            <span>{currentStory?.views.length ?? 0} مشاهدة</span>
          </div>
        )}
      </footer>
    </div>
  );
}
