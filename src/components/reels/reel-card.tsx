import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { query, where, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
import {
  tweetsCollection,
  userStatsCollection
} from '@lib/firebase/collections';
import { likeReel, viewReel, deleteReel } from '@lib/firebase/utils';
import { formatNumber } from '@lib/date';
import { preventBubbling } from '@lib/utils';
import { UserAvatar } from '@components/user/user-avatar';
import { VerifiedBadge } from '@components/ui/verified-badge';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { ReelsComments } from './reels-comments';
import type { Story } from '@lib/types/story';
import type { User } from '@lib/types/user';

type ReelCardProps = {
  reel: Story;
  user: User;
  isActive?: boolean;
};

const DOUBLE_TAP_MS = 280;

// Particle offsets for the heart burst effect
const PARTICLES = [
  { x: -55, y: -65, r: -25, s: 0.9, delay: 0 },
  { x: 55, y: -60, r: 25, s: 0.85, delay: 0.03 },
  { x: -75, y: 10, r: -40, s: 0.75, delay: 0.02 },
  { x: 80, y: 15, r: 35, s: 0.9, delay: 0.04 },
  { x: -45, y: 70, r: -15, s: 0.8, delay: 0.03 },
  { x: 50, y: 65, r: 20, s: 0.95, delay: 0.05 },
  { x: 0, y: -85, r: 0, s: 1.1, delay: 0.01 },
  { x: 0, y: 85, r: 0, s: 0.75, delay: 0.06 }
];

export function ReelCard({ reel, user, isActive = true }: ReelCardProps): JSX.Element {
  const { user: authUser } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { open: confirmOpen, openModal: openConfirm, closeModal: closeConfirm } =
    useModal();
  const {
    open: menuOpen,
    openModal: openMenu,
    closeModal: closeMenu
  } = useModal();
  const {
    open: commentsOpen,
    openModal: openCommentsModal,
    closeModal: closeComments
  } = useModal();

  const [burst, setBurst] = useState(0);
  const [burstCoords, setBurstCoords] = useState<{ x: number; y: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const userMutedRef = useRef(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [showMuteIcon, setShowMuteIcon] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isExpandedCaption, setIsExpandedCaption] = useState(false);

  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const viewedRef = useRef(false);

  const media = reel.images?.[0];
  const isVideo = media?.type?.startsWith('video/') ?? true;

  const isLiked = reel.likes?.includes(authUser?.id ?? '') ?? false;
  const isOwner = authUser?.id === reel.userId;

  // Live comment count for this reel
  const commentsCountQuery = useMemo(
    () => (reel.id ? query(tweetsCollection, where('parent.id', '==', reel.id)) : null),
    [reel.id]
  );
  const { data: commentsDocs } = useCollection(commentsCountQuery, {
    allowNull: true
  });
  const commentCount = commentsDocs?.length ?? 0;

  // Record a view once when the reel mounts
  useEffect(() => {
    if (viewedRef.current || !authUser || isOwner) return;
    viewedRef.current = true;
    void viewReel(reel.id, authUser.id).catch(() => null);
  }, [reel.id, authUser, isOwner]);

  // Pause / Play based on active visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            video.muted = true;
            setIsMuted(true);
            void video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const toggleLike = useCallback(
    async (forceLike?: boolean): Promise<void> => {
      if (!authUser) {
        toast.error('يرجى تسجيل الدخول أولاً');
        return;
      }
      const nextLiked = forceLike ?? !isLiked;
      if (nextLiked === isLiked && forceLike === undefined) return;
      await likeReel(reel.id, authUser.id, reel.userId, nextLiked);
    },
    [authUser, isLiked, reel.id, reel.userId]
  );

  const triggerHeartBurst = useCallback((coords?: { x: number; y: number }): void => {
    if (coords) {
      setBurstCoords(coords);
    } else if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setBurstCoords({ x: rect.width / 2, y: rect.height / 2 });
    }
    setBurst((b) => b + 1);
  }, []);

  const handleVideoTimeUpdate = (): void => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  const togglePlayPause = (): void => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // A real user gesture — sound is allowed now, honor it unless the
      // user explicitly muted via the speaker button.
      if (!userMutedRef.current) {
        video.muted = false;
        setIsMuted(false);
      }
      void video.play().then(() => {
        setIsPlaying(true);
        setShowPlayIcon(true);
        setTimeout(() => setShowPlayIcon(false), 600);
      });
    } else {
      video.pause();
      setIsPlaying(false);
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 600);
    }
  };

  const toggleMute = (e?: React.MouseEvent): void => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    userMutedRef.current = nextMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    setShowMuteIcon(true);
    setTimeout(() => setShowMuteIcon(false), 700);
  };

  // Reel retweets are tracked on the viewer's own stats doc — the Firestore
  // rules only permit likes/views edits on story docs.
  const ownStatsRef = authUser
    ? doc(userStatsCollection(authUser.id), 'stats')
    : null;
  const { data: ownStats } = useDocument(ownStatsRef, {
    allowNull: true,
    disabled: !authUser
  });

  const isRetweeted = ownStats?.reels?.includes(reel.id) ?? false;
  const [optimisticRetweet, setOptimisticRetweet] = useState<boolean | null>(
    null
  );
  const retweeted = optimisticRetweet ?? isRetweeted;

  useEffect(() => {
    if (optimisticRetweet !== null && isRetweeted === optimisticRetweet)
      setOptimisticRetweet(null);
  }, [isRetweeted, optimisticRetweet]);

  const handleRetweet = (e?: React.MouseEvent): void => {
    if (e) e.stopPropagation();
    if (!authUser) return;
    const next = !retweeted;
    setOptimisticRetweet(next);
    void updateDoc(doc(userStatsCollection(authUser.id), 'stats'), {
      reels: next ? arrayUnion(reel.id) : arrayRemove(reel.id)
    }).catch(() => {
      setOptimisticRetweet(null);
      toast.error('تعذر تنفيذ العملية، حاول مجدداً');
    });
  };

  // Handles clicks anywhere across the entire reel card frame
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement;
    // Don't intercept actual interactive child buttons or links
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }

    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;

    const rect = cardRef.current?.getBoundingClientRect();
    let clickX = (rect?.width || 360) / 2;
    let clickY = (rect?.height || 640) / 2;

    if (rect) {
      // Safely clamp coordinates within the card frame so burst animation stays inside
      const margin = 70;
      clickX = Math.max(margin, Math.min(rect.width - margin, e.clientX - rect.left));
      clickY = Math.max(margin, Math.min(rect.height - margin, e.clientY - rect.top));
    }

    if (delta < DOUBLE_TAP_MS) {
      // Double click / tap anywhere -> like and 3D flip burst animation
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;
      void toggleLike(true);
      triggerHeartBurst({ x: clickX, y: clickY });
    } else {
      // Single click anywhere -> toggle play/pause
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = setTimeout(() => {
        togglePlayPause();
        tapTimeoutRef.current = null;
      }, DOUBLE_TAP_MS);
    }
  };

  const handleLikeButton = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    void toggleLike();
    if (!isLiked) triggerHeartBurst();
  };

  const openComments = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    openCommentsModal();
  };

  const handleShare = async (e?: React.MouseEvent): Promise<void> => {
    if (e) e.stopPropagation();
    closeMenu();
    const reelUrl = typeof window !== 'undefined' ? `${window.location.origin}/reels` : '';
    const shareData = {
      title: `ريل بواسطة ${user.name}`,
      text: reel.caption || 'شاهد هذا الريل على Aite!',
      url: reelUrl
    };

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(shareData);
        toast.success('تمت المشاركة بنجاح');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(reelUrl);
          toast.success('تم نسخ رابط الريل');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(reelUrl);
        toast.success('تم نسخ رابط الريل إلى الحافظة');
      } catch {
        toast.error('تعذر نسخ الرابط');
      }
    }
  };

  const handleCopyLink = async (e?: React.MouseEvent): Promise<void> => {
    if (e) e.stopPropagation();
    closeMenu();
    const reelUrl = typeof window !== 'undefined' ? `${window.location.origin}/reels` : '';
    try {
      await navigator.clipboard.writeText(reelUrl);
      toast.success('تم نسخ رابط الريل');
    } catch {
      toast.error('تعذر نسخ الرابط');
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!authUser || authUser.id !== reel.userId) return;
    setIsDeleting(true);
    try {
      await deleteReel(reel.id, authUser.id);
      toast.success('تم حذف الريل بنجاح');
    } catch {
      toast.error('فشل حذف الريل');
    } finally {
      setIsDeleting(false);
      closeConfirm();
    }
  };

  const captionText = reel.caption || '';
  const isLongCaption = captionText.length > 85;

  return (
    <section
      ref={cardRef}
      onClick={handleCardClick}
      className='relative h-full w-full snap-center overflow-hidden bg-black select-none cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none [-webkit-tap-highlight-color:transparent]'
    >
      {/* Media Layer */}
      <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
        {media &&
          (isVideo ? (
            <video
              ref={videoRef}
              src={media.src}
              autoPlay={isActive}
              loop
              muted={isMuted}
              playsInline
              onTimeUpdate={handleVideoTimeUpdate}
              className='h-full w-full object-cover outline-none pointer-events-none'
            />
          ) : (
            <img
              src={media.src}
              alt={media.alt || 'Reel media'}
              className='h-full w-full object-cover outline-none pointer-events-none'
            />
          ))}

        {/* Gradient overlays for contrast and readability */}
        <div className='absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85 pointer-events-none' />
      </div>

      {/* Center Animated Play / Pause Indicator */}
      <AnimatePresence>
        {showPlayIcon && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className='pointer-events-none absolute inset-0 flex items-center justify-center z-30'
          >
            <div className='flex h-18 w-18 items-center justify-center rounded-full bg-black/45 backdrop-blur-md text-white shadow-2xl border border-white/10'>
              <HeroIcon
                className={cn('h-9 w-9 text-white', isPlaying ? 'translate-x-0.5' : '')}
                iconName={isPlaying ? 'PlayIcon' : 'PauseIcon'}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center Sound Toggle Indicator */}
      <AnimatePresence>
        {showMuteIcon && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className='pointer-events-none absolute inset-0 flex items-center justify-center z-30'
          >
            <div className='flex items-center gap-2 rounded-full bg-black/75 px-5 py-2.5 text-sm font-bold text-white shadow-2xl backdrop-blur-md border border-white/10'>
              <HeroIcon
                className='h-5 w-5 text-main-accent'
                iconName={isMuted ? 'SpeakerXMarkIcon' : 'SpeakerWaveIcon'}
              />
              <span>{isMuted ? 'تم كتم الصوت' : 'تم تشغيل الصوت'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Floating Controls */}
      <div className='absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none'>
        {/* Sound toggle button */}
        <button
          type='button'
          onClick={toggleMute}
          className='pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md shadow border border-white/10 transition hover:bg-black/70 active:scale-90 outline-none focus:outline-none [-webkit-tap-highlight-color:transparent]'
          aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
        >
          <HeroIcon
            className='h-5 w-5'
            iconName={isMuted ? 'SpeakerXMarkIcon' : 'SpeakerWaveIcon'}
          />
        </button>
      </div>

      {/* Clean, High-End Double-Tap Heart Burst Animation */}
      <AnimatePresence>
        {burst > 0 && burstCoords && (
          <div
            key={`burst-${burst}`}
            className='pointer-events-none absolute z-30 overflow-visible'
            style={{
              left: `${burstCoords.x}px`,
              top: `${burstCoords.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Popping Gradient Heart */}
            <motion.div
              initial={{ scale: 0, rotate: -15, opacity: 0 }}
              animate={{
                scale: [0, 1.35, 1, 1.15, 0],
                rotate: [-15, 8, -4, 0, 0],
                y: [0, -10, -20, -35, -50],
                opacity: [0, 1, 1, 0.9, 0]
              }}
              transition={{
                duration: 0.85,
                times: [0, 0.22, 0.45, 0.75, 1],
                ease: 'easeOut'
              }}
              className='relative flex items-center justify-center'
            >
              <HeroIcon
                className='h-24 w-24 text-rose-500 filter drop-shadow-[0_8px_24px_rgba(244,63,94,0.85)]'
                solid
                iconName='HeartIcon'
              />
            </motion.div>

            {/* Radial Sparkle Particle Hearts */}
            {PARTICLES.map((p, idx) => (
              <motion.div
                key={idx}
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{
                  x: p.x,
                  y: [0, p.y * 0.85, p.y - 30],
                  scale: [0, p.s, p.s * 0.9, 0],
                  opacity: [0, 1, 0.85, 0],
                  rotate: p.r
                }}
                transition={{
                  duration: 0.75,
                  delay: p.delay,
                  ease: 'easeOut'
                }}
                className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center'
              >
                <HeroIcon
                  className='h-5 w-5 text-rose-400 filter drop-shadow-[0_4px_10px_rgba(244,63,94,0.7)]'
                  solid
                  iconName='HeartIcon'
                />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* LEFT SIDE: Interaction Action Rail (Likes, Comments, Share, Menu, Audio) */}
      {/* Strictly pinned to the PHYSICAL LEFT                                      */}
      {/* ========================================================================= */}
      <div
        className='absolute left-4 bottom-20 xs:bottom-16 sm:bottom-14 z-20 flex flex-col items-center gap-5 text-white'
      >
        {/* Like Button */}
        <div className='flex flex-col items-center gap-1.5'>
          <button
            type='button'
            onClick={handleLikeButton}
            className='flex h-10 w-10 items-center justify-center text-white transition active:scale-75 hover:scale-110 outline-none focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]'
            aria-label={isLiked ? 'إلغاء الإعجاب' : 'إعجاب'}
          >
            <motion.div
              key={isLiked ? 'liked' : 'unliked'}
              initial={{ scale: 0.6 }}
              animate={{ scale: [0.6, 1.3, 1] }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              <HeroIcon
                className={cn(
                  'h-8 w-8 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-colors',
                  isLiked
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-white hover:text-rose-400'
                )}
                solid={isLiked}
                iconName='HeartIcon'
              />
            </motion.div>
          </button>
          <span className='text-xs font-bold drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]'>
            {formatNumber(reel.likes?.length ?? 0)}
          </span>
        </div>

        {/* Comments Button */}
        <div className='flex flex-col items-center gap-1.5'>
          <button
            type='button'
            onClick={openComments}
            className='flex h-10 w-10 items-center justify-center text-white transition active:scale-75 hover:scale-110 outline-none focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]'
            aria-label='التعليقات'
          >
            <HeroIcon
              className='h-8 w-8 text-white filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-colors hover:text-main-accent'
              iconName='ChatBubbleOvalLeftIcon'
            />
          </button>
          <span className='text-xs font-bold drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]'>
            {commentCount ? formatNumber(commentCount) : '0'}
          </span>
        </div>

        {/* Retweet Button */}
        <div className='flex flex-col items-center gap-1.5'>
          <button
            type='button'
            onClick={handleRetweet}
            className='flex h-10 w-10 items-center justify-center text-white transition active:scale-75 hover:scale-110 outline-none focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]'
            aria-label={retweeted ? 'تراجع عن إعادة النشر' : 'إعادة نشر'}
          >
            <motion.div
              key={retweeted ? 'retweeted' : 'idle'}
              initial={{ scale: 0.6 }}
              animate={{ scale: [0.6, 1.3, 1] }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              <HeroIcon
                className={cn(
                  'h-8 w-8 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-colors',
                  retweeted
                    ? 'fill-accent-green text-accent-green'
                    : 'text-white hover:text-accent-green'
                )}
                iconName='ArrowPathRoundedSquareIcon'
              />
            </motion.div>
          </button>
        </div>

        {/* Share Button */}
        <div className='flex flex-col items-center gap-1.5'>
          <button
            type='button'
            onClick={handleShare}
            className='flex h-10 w-10 items-center justify-center text-white transition active:scale-75 hover:scale-110 outline-none focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]'
            aria-label='مشاركة'
          >
            <HeroIcon
              className='h-8 w-8 text-white filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-colors hover:text-main-accent'
              iconName='ArrowUpTrayIcon'
            />
          </button>
          <span className='text-xs font-bold drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]'>مشاركة</span>
        </div>

        {/* Three Dots Menu Button */}
        <div className='flex flex-col items-center gap-1.5'>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              openMenu();
            }}
            className='flex h-9 w-9 items-center justify-center text-white transition active:scale-75 hover:scale-110 outline-none focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]'
            aria-label='المزيد من الخيارات'
          >
            <HeroIcon
              className='h-7 w-7 text-white filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-colors hover:text-main-accent'
              iconName='EllipsisVerticalIcon'
            />
          </button>
        </div>

        {/* Music animation indicator if present */}
        {reel.music?.name && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            className='flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/70 bg-gradient-to-tr from-gray-900 to-black text-white shadow-lg mt-1'
          >
            <HeroIcon className='h-4 w-4 text-main-accent' iconName='MusicalNoteIcon' />
          </motion.div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* RIGHT SIDE: User Profile Details & Caption                                */}
      {/* Strictly pinned to the PHYSICAL RIGHT                                     */}
      {/* ========================================================================= */}
      <div
        dir='rtl'
        className='absolute right-4 bottom-8 z-20 flex max-w-[65%] flex-col items-start text-right gap-2 text-white'
      >
        {/* User profile row with verified badge */}
        <Link href={`/user/${user.username}`}>
          <a
            onClick={(e) => e.stopPropagation()}
            className='flex items-center gap-2.5 group'
          >
            <div className='relative shrink-0'>
              <UserAvatar
                src={user.photoURL}
                alt={user.name}
                username={user.username}
                size={42}
                className='ring-2 ring-white/90 transition group-hover:ring-main-accent shadow-md'
              />
            </div>
            <div className='flex flex-col min-w-0 text-right'>
              <div className='flex items-center gap-1 truncate'>
                <span className='truncate font-bold text-sm leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] group-hover:text-main-accent transition-colors'>
                  {user.name}
                </span>
                {user.verified && (
                  <VerifiedBadge className='h-4 w-4 shrink-0' />
                )}
              </div>
              <span className='text-xs text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] truncate'>
                @{user.username}
              </span>
            </div>
          </a>
        </Link>

        {/* Caption with expansion */}
        {captionText && (
          <div className='text-sm leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]'>
            <p
              className={cn(
                'whitespace-pre-line break-words text-white/95',
                !isExpandedCaption && isLongCaption && 'line-clamp-2'
              )}
            >
              {captionText}
            </p>
            {isLongCaption && (
              <button
                type='button'
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpandedCaption((prev) => !prev);
                }}
                className='mt-0.5 text-xs font-bold text-main-accent underline hover:brightness-110'
              >
                {isExpandedCaption ? 'عرض أقل' : 'المزيد...'}
              </button>
            )}
          </div>
        )}

        {/* Music track tag */}
        {reel.music?.name && (
          <div className='flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs text-white/90 backdrop-blur-md max-w-fit shadow border border-white/10'>
            <HeroIcon className='h-3.5 w-3.5 shrink-0 text-main-accent animate-pulse' iconName='MusicalNoteIcon' />
            <span className='truncate font-medium'>{reel.music.name}</span>
          </div>
        )}
      </div>

      {/* Video Real-time Progress Bar at the bottom */}
      {isVideo && (
        <div className='absolute bottom-0 inset-x-0 h-1 bg-white/20 z-20 pointer-events-none'>
          <motion.div
            className='h-full bg-main-accent shadow-sm'
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* 3-Dots Action Menu Modal */}
      <Modal
        open={menuOpen}
        closeModal={closeMenu}
        modalClassName='w-full max-w-xs rounded-3xl border border-light-border bg-main-background p-4 shadow-2xl dark:border-dark-border'
      >
        <div className='flex flex-col gap-2' onClick={preventBubbling()}>
          {isOwner && (
            <button
              type='button'
              onClick={() => {
                closeMenu();
                openConfirm();
              }}
              className='flex items-center gap-3 w-full rounded-2xl p-3 text-sm font-bold text-accent-red hover:bg-accent-red/10 transition active:scale-98'
            >
              <HeroIcon className='h-5 w-5 text-accent-red' iconName='TrashIcon' />
              <span>حذف الريل</span>
            </button>
          )}
          <button
            type='button'
            onClick={handleCopyLink}
            className='flex items-center gap-3 w-full rounded-2xl p-3 text-sm font-bold text-light-primary dark:text-dark-primary hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition active:scale-98'
          >
            <HeroIcon className='h-5 w-5 text-light-secondary dark:text-dark-secondary' iconName='LinkIcon' />
            <span>نسخ الرابط</span>
          </button>
          <button
            type='button'
            onClick={handleShare}
            className='flex items-center gap-3 w-full rounded-2xl p-3 text-sm font-bold text-light-primary dark:text-dark-primary hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 transition active:scale-98'
          >
            <HeroIcon className='h-5 w-5 text-light-secondary dark:text-dark-secondary' iconName='ShareIcon' />
            <span>مشاركة الريل</span>
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={confirmOpen}
        closeModal={closeConfirm}
        modalClassName='w-full max-w-sm rounded-3xl border border-light-border bg-main-background p-6 shadow-2xl dark:border-dark-border'
      >
        <div onClick={preventBubbling()}>
          <ActionModal
            title='حذف الريل؟'
            description='لن يمكن التراجع عن حذف هذا الريل بعد تأكيد الحذف.'
            mainBtnLabel='حذف نهائي'
            mainBtnClassName='bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/75'
            secondaryBtnLabel='إلغاء'
            action={confirmDelete}
            closeModal={closeConfirm}
            loading={isDeleting}
          />
        </div>
      </Modal>

      {/* Comments Bottom Sheet Modal */}
      <ReelsComments
        open={commentsOpen}
        reelId={reel.id}
        reelOwnerId={reel.userId}
        closeModal={closeComments}
      />
    </section>
  );
}
