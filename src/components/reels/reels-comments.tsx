import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { useCollection } from '@lib/hooks/useCollection';
import { tweetsCollection } from '@lib/firebase/collections';
import { addReelComment, deleteReelComment } from '@lib/firebase/utils';
import { formatDate } from '@lib/date';
import { UserAvatar } from '@components/user/user-avatar';
import { VerifiedBadge } from '@components/ui/verified-badge';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { preventBubbling } from '@lib/utils';
import type { TweetWithUser } from '@lib/types/tweet';

type ReelsCommentsProps = {
  open: boolean;
  reelId: string;
  reelOwnerId: string;
  closeModal: () => void;
};

type ReplyingTo = {
  id: string;
  name: string;
  username: string;
  text?: string | null;
} | null;

type DeleteTarget = {
  id: string;
  isReply: boolean;
} | null;

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😍', '😂', '🙌', '✨', '💯'];

export function ReelsComments({
  open,
  reelId,
  reelOwnerId,
  closeModal
}: ReelsCommentsProps): JSX.Element {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo>(null);
  const [optimisticLikes, setOptimisticLikes] = useState<
    Record<string, string[]>
  >({});
  const [optimisticComments, setOptimisticComments] = useState<TweetWithUser[]>(
    []
  );
  const [expandedThreads, setExpandedThreads] = useState<
    Record<string, boolean>
  >({});
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastLongPressTimeRef = useRef<number>(0);

  // Long press handler for deleting comments and replies
  const startLongPress = (
    id: string,
    isReply = false,
    canDelete = false
  ): void => {
    if (!canDelete) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      lastLongPressTimeRef.current = Date.now();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch {
          // Ignore if vibration is restricted
        }
      }
      handleDeletePrompt(id, isReply);
    }, 500);
  };

  const cancelLongPress = (e?: React.SyntheticEvent): void => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (e && Date.now() - lastLongPressTimeRef.current < 400) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Query comments belonging to this reel (only when modal is open and reelId exists)
  const commentsQuery = useMemo(
    () =>
      open && reelId
        ? query(tweetsCollection, where('parent.id', '==', reelId))
        : null,
    [open, reelId]
  );

  const { data: rawComments, loading } = useCollection(commentsQuery, {
    includeUser: true,
    allowNull: true,
    disabled: !open || !reelId
  });

  // Merge server comments with local optimistic comments cleanly without duplicate flash
  const allComments = useMemo(() => {
    const serverList = rawComments ?? [];
    const serverIds = new Set(serverList.map((c) => c.id));

    // Filter out optimistic comments that already arrived from Firestore snapshot
    const pendingOptimistic = optimisticComments.filter((opt) => {
      if (serverIds.has(opt.id)) return false;
      const isAlreadyInServer = serverList.some(
        (srv) => srv.createdBy === opt.createdBy && srv.text === opt.text
      );
      return !isAlreadyInServer;
    });

    const combined = [...pendingOptimistic, ...serverList];

    return combined.sort((a, b) => {
      const aTime =
        typeof a.createdAt?.toMillis === 'function'
          ? a.createdAt.toMillis()
          : (a.createdAt as unknown as { seconds?: number })?.seconds
          ? (a.createdAt as unknown as { seconds: number }).seconds * 1000
          : Date.now();
      const bTime =
        typeof b.createdAt?.toMillis === 'function'
          ? b.createdAt.toMillis()
          : (b.createdAt as unknown as { seconds?: number })?.seconds
          ? (b.createdAt as unknown as { seconds: number }).seconds * 1000
          : Date.now();
      return bTime - aTime;
    });
  }, [rawComments, optimisticComments]);

  // Group comments into structured root comments and threaded replies
  const { rootComments, repliesByParent } = useMemo(() => {
    const roots: TweetWithUser[] = [];
    const repliesMap = new Map<string, TweetWithUser[]>();
    const allIds = new Set(allComments.map((c) => c.id));

    // First collect replies
    for (const c of allComments) {
      const parentCommentId = c.replyTo?.id;
      if (parentCommentId && allIds.has(parentCommentId)) {
        const existing = repliesMap.get(parentCommentId) ?? [];
        existing.push(c);
        repliesMap.set(parentCommentId, existing);
      } else if (!parentCommentId) {
        // Only include true root comments (omit orphaned replies whose parent was deleted)
        roots.push(c);
      }
    }

    // Sort replies chronologically within each parent thread
    repliesMap.forEach((repList, parentId) => {
      repList.sort((a, b) => {
        const aTime =
          typeof a.createdAt?.toMillis === 'function'
            ? a.createdAt.toMillis()
            : (a.createdAt as unknown as { seconds?: number })?.seconds
            ? (a.createdAt as unknown as { seconds: number }).seconds * 1000
            : 0;
        const bTime =
          typeof b.createdAt?.toMillis === 'function'
            ? b.createdAt.toMillis()
            : (b.createdAt as unknown as { seconds?: number })?.seconds
            ? (b.createdAt as unknown as { seconds: number }).seconds * 1000
            : 0;
        return aTime - bTime;
      });
      repliesMap.set(parentId, repList);
    });

    return { rootComments: roots, repliesByParent: repliesMap };
  }, [allComments]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setComment('');
      setReplyingTo(null);
    }
  }, [open]);

  const handleReplyClick = (commentItem: TweetWithUser): void => {
    setReplyingTo({
      id: commentItem.id,
      name: commentItem.user.name,
      username: commentItem.user.username,
      text: commentItem.text
    });
    // Automatically expand the parent thread when replying to it
    setExpandedThreads((prev) => ({ ...prev, [commentItem.id]: true }));
    inputRef.current?.focus();
  };

  const cancelReply = (): void => {
    setReplyingTo(null);
  };

  const toggleThreadReplies = (commentId: string): void => {
    setExpandedThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const handleSubmit = async (
    e?: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = comment.trim();
    if (!trimmed || !user) {
      if (!user) toast.error('يرجى تسجيل الدخول للتعليق');
      return;
    }

    setSending(true);

    const replyMetadata = replyingTo
      ? {
          id: replyingTo.id,
          username: replyingTo.username,
          name: replyingTo.name,
          text: replyingTo.text ?? null
        }
      : null;

    // Create optimistic comment object for instant UI rendering
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const optimisticItem: TweetWithUser = {
      id: tempId,
      text: trimmed,
      images: null,
      parent: { id: reelId, username: reelOwnerId || '' },
      replyTo: replyMetadata,
      userLikes: [],
      createdBy: user.id,
      createdAt: Timestamp.now(),
      updatedAt: null,
      userReplies: 0,
      userRetweets: [],
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        photoURL: user.photoURL,
        verified: user.verified ?? false,
        bio: user.bio ?? null,
        theme: user.theme ?? null,
        accent: user.accent ?? null,
        website: user.website ?? null,
        location: user.location ?? null,
        following: user.following ?? [],
        followers: user.followers ?? [],
        createdAt: user.createdAt ?? Timestamp.now(),
        updatedAt: user.updatedAt ?? Timestamp.now(),
        totalTweets: user.totalTweets ?? 0,
        totalPhotos: user.totalPhotos ?? 0,
        pinnedTweet: user.pinnedTweet ?? null,
        coverPhotoURL: user.coverPhotoURL ?? null
      }
    };

    setOptimisticComments((prev) => [optimisticItem, ...prev]);
    setComment('');
    const parentReplyId = replyingTo?.id;
    setReplyingTo(null);

    // If it was a reply, ensure the thread is open so user sees their reply
    if (parentReplyId) {
      setExpandedThreads((prev) => ({ ...prev, [parentReplyId]: true }));
    }

    try {
      await addReelComment(
        reelId,
        reelOwnerId,
        user.id,
        trimmed,
        replyMetadata
      );
      // Cleanly remove the temp item when server confirms without UI flicker
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
    } catch (err) {
      console.error('Failed to post comment:', err);
      toast.error('فشل نشر التعليق، يرجى المحاولة مرة أخرى');
      // Rollback optimistic comment
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleDeletePrompt = (commentId: string, isReply = false): void => {
    setDeleteTarget({ id: commentId, isReply });
  };

  const confirmDeleteComment = async (): Promise<void> => {
    if (!user || !deleteTarget) return;
    const targetId = deleteTarget.id;
    const isReply = deleteTarget.isReply;
    setIsDeleting(true);

    // Optimistically remove comment/reply and all its recursive descendant replies
    setOptimisticComments((prev) => {
      const removedIds = new Set<string>([targetId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const item of prev) {
          if (
            !removedIds.has(item.id) &&
            item.replyTo?.id &&
            removedIds.has(item.replyTo.id)
          ) {
            removedIds.add(item.id);
            changed = true;
          }
        }
      }
      return prev.filter((c) => !removedIds.has(c.id));
    });

    try {
      await deleteReelComment(targetId, user.id);
      toast.success(isReply ? 'تم حذف الرد بنجاح' : 'تم حذف التعليق بنجاح');
    } catch (err) {
      console.error('Failed to delete comment:', err);
      toast.error('فشل حذف التعليق');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleEmojiClick = (emoji: string): void => {
    setComment((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const toggleCommentLike = useCallback(
    (commentId: string, currentLikes: string[]) =>
      async (e: React.MouseEvent): Promise<void> => {
        e.stopPropagation();
        if (!user) {
          toast.error('يرجى تسجيل الدخول أولاً');
          return;
        }

        const effectiveLikes = optimisticLikes[commentId] ?? currentLikes ?? [];
        const isLiked = effectiveLikes.includes(user.id);
        const updatedLikes = isLiked
          ? effectiveLikes.filter((id) => id !== user.id)
          : [...effectiveLikes, user.id];

        // Optimistic UI update
        setOptimisticLikes((prev) => ({ ...prev, [commentId]: updatedLikes }));

        try {
          const commentRef = doc(tweetsCollection, commentId);
          await updateDoc(commentRef, {
            userLikes: isLiked ? arrayRemove(user.id) : arrayUnion(user.id),
            updatedAt: serverTimestamp()
          });
        } catch {
          toast.error('تعذر تحديث الإعجاب');
          // Revert optimistic update
          setOptimisticLikes((prev) => ({
            ...prev,
            [commentId]: effectiveLikes
          }));
        }
      },
    [user, optimisticLikes]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeModal}
          className='fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-sm'
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            onClick={(e) => e.stopPropagation()}
            className='mx-auto flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border-t border-light-border bg-main-background shadow-2xl dark:border-dark-border'
          >
            {/* Drag Pill Handle */}
            <div
              className='flex cursor-pointer justify-center pb-1 pt-3'
              onClick={closeModal}
            >
              <div className='h-1.5 w-12 rounded-full bg-light-line-reply dark:bg-dark-line-reply' />
            </div>

            {/* Header */}
            <div className='flex items-center justify-between border-b border-light-border px-5 py-3 dark:border-dark-border'>
              <div className='flex items-center gap-2'>
                <h2 className='text-base font-bold text-light-primary dark:text-dark-primary'>
                  التعليقات
                </h2>
                {!!allComments?.length && (
                  <span className='rounded-full bg-light-line-reply/50 px-2 py-0.5 text-xs font-semibold text-light-secondary dark:bg-dark-line-reply/50 dark:text-dark-secondary'>
                    {allComments.length}
                  </span>
                )}
              </div>
              <Button
                className='rounded-full p-1.5 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
                onClick={closeModal}
              >
                <HeroIcon
                  className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
                  iconName='XMarkIcon'
                />
              </Button>
            </div>

            {/* Comments List */}
            <div
              ref={listContainerRef}
              className='flex-1 space-y-4 overflow-y-auto scroll-smooth px-5 py-4'
            >
              {loading && !allComments.length ? (
                <div className='flex justify-center py-12'>
                  <Loading className='mt-2' />
                </div>
              ) : !allComments?.length ? (
                <div className='flex flex-col items-center justify-center gap-2 py-12 text-center text-light-secondary dark:text-dark-secondary'>
                  <div className='flex h-14 w-14 items-center justify-center rounded-full bg-light-line-reply/30 text-light-secondary dark:bg-dark-line-reply/30 dark:text-dark-secondary'>
                    <HeroIcon
                      className='h-7 w-7'
                      iconName='ChatBubbleBottomCenterTextIcon'
                    />
                  </div>
                  <p className='text-sm font-semibold text-light-primary dark:text-dark-primary'>
                    لا توجد تعليقات بعد
                  </p>
                  <p className='text-xs opacity-75'>
                    كن أول من يعلق ويبدأ المحادثة على هذا الريل!
                  </p>
                </div>
              ) : (
                <div className='flex flex-col gap-4'>
                  {rootComments.map((item: TweetWithUser) => {
                    const currentLikes =
                      optimisticLikes[item.id] ?? item.userLikes ?? [];
                    const isLiked = currentLikes.includes(user?.id ?? '');
                    const isCommentAuthor = user?.id === item.createdBy;
                    const isReelOwner = user?.id === reelOwnerId;
                    const canDelete = isCommentAuthor || isReelOwner;
                    const replies = repliesByParent.get(item.id) ?? [];
                    const hasReplies = replies.length > 0;
                    const isExpanded = expandedThreads[item.id] ?? false;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex select-none flex-col rounded-2xl p-2 transition-colors',
                          canDelete &&
                            'cursor-pointer hover:bg-light-primary/[0.03] active:scale-[0.99] dark:hover:bg-white/[0.03]'
                        )}
                        onTouchStart={() =>
                          startLongPress(item.id, false, canDelete)
                        }
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onMouseDown={() =>
                          startLongPress(item.id, false, canDelete)
                        }
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onContextMenu={(e) => {
                          if (canDelete) {
                            e.preventDefault();
                            handleDeletePrompt(item.id, false);
                          }
                        }}
                      >
                        {/* Main / Root Comment Item */}
                        <div className='group flex items-start gap-3'>
                          <UserAvatar
                            src={item.user.photoURL}
                            alt={item.user.name}
                            username={item.user.username}
                            size={38}
                          />
                          <div className='flex flex-1 flex-col'>
                            <div className='flex items-center gap-1.5'>
                              <span className='text-sm font-bold text-light-primary dark:text-dark-primary'>
                                {item.user.name}
                              </span>
                              {item.user.verified && (
                                <VerifiedBadge className='h-3.5 w-3.5' />
                              )}
                              <span className='mr-auto text-xs text-light-secondary dark:text-dark-secondary'>
                                {formatDate(item.createdAt, 'message')}
                              </span>
                            </div>

                            {/* Orphaned reply banner if parent is absent */}
                            {item.replyTo?.username && (
                              <div className='mt-1 inline-flex max-w-fit items-center gap-1.5 rounded-lg bg-main-accent/10 px-2 py-0.5 text-xs font-medium text-main-accent-text'>
                                <HeroIcon
                                  className='h-3 w-3 shrink-0 rotate-180'
                                  iconName='ArrowUturnLeftIcon'
                                />
                                <span>
                                  رداً على{' '}
                                  <strong>@{item.replyTo.username}</strong>
                                </span>
                              </div>
                            )}

                            <p className='mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-light-primary dark:text-dark-primary'>
                              {item.text}
                            </p>

                            {/* Action row: Reply button, Likes count */}
                            <div className='mt-2 flex items-center gap-4 text-xs font-semibold text-light-secondary dark:text-dark-secondary'>
                              <button
                                type='button'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReplyClick(item);
                                }}
                                className='flex items-center gap-1 transition hover:text-main-accent-text active:scale-95'
                              >
                                <HeroIcon
                                  className='h-3.5 w-3.5 rotate-180'
                                  iconName='ArrowUturnLeftIcon'
                                />
                                <span>رد</span>
                              </button>

                              {!!currentLikes.length && (
                                <span className='flex items-center gap-1 font-medium text-rose-500'>
                                  <HeroIcon
                                    className='h-3.5 w-3.5 fill-rose-500 text-rose-500'
                                    solid
                                    iconName='HeartIcon'
                                  />
                                  <span>{currentLikes.length}</span>
                                </span>
                              )}
                            </div>

                            {/* Toggle Replies Accordion Button */}
                            {hasReplies && (
                              <button
                                type='button'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleThreadReplies(item.id);
                                }}
                                className='mt-2.5 flex select-none items-center gap-2 text-xs font-bold text-main-accent-text transition hover:brightness-110'
                              >
                                <span className='h-[1px] w-6 bg-main-accent/60' />
                                <span>
                                  {isExpanded
                                    ? 'إخفاء الردود'
                                    : `عرض الردود (${replies.length})`}
                                </span>
                                <HeroIcon
                                  className={cn(
                                    'h-3.5 w-3.5 transition-transform duration-200',
                                    isExpanded && 'rotate-180'
                                  )}
                                  iconName='ChevronDownIcon'
                                />
                              </button>
                            )}
                          </div>

                          {/* Comment Like Heart Button */}
                          <button
                            type='button'
                            onClick={toggleCommentLike(item.id, item.userLikes)}
                            className='p-1.5 text-light-secondary transition hover:text-rose-500 dark:text-dark-secondary'
                            aria-label={
                              isLiked ? 'إلغاء إعجاب التعليق' : 'إعجاب بالتعليق'
                            }
                          >
                            <HeroIcon
                              className={cn(
                                'h-4 w-4 transition-transform active:scale-125',
                                isLiked
                                  ? 'fill-rose-500 text-rose-500'
                                  : 'text-light-secondary dark:text-dark-secondary'
                              )}
                              solid={isLiked}
                              iconName='HeartIcon'
                            />
                          </button>
                        </div>

                        {/* Nested Thread Replies with Distinct Visual Indentation & Connected Rail */}
                        {hasReplies && isExpanded && (
                          <div className='mr-5 mt-2.5 flex flex-col gap-3 border-r-2 border-dashed border-main-accent/30 py-1 pr-3.5'>
                            {replies.map((reply: TweetWithUser) => {
                              const replyLikes =
                                optimisticLikes[reply.id] ??
                                reply.userLikes ??
                                [];
                              const isReplyLiked = replyLikes.includes(
                                user?.id ?? ''
                              );
                              const isReplyAuthor =
                                user?.id === reply.createdBy;
                              const canDeleteReply =
                                isReplyAuthor || isReelOwner;

                              return (
                                <div
                                  key={reply.id}
                                  className={cn(
                                    'flex select-none items-start gap-2.5 rounded-2xl border border-light-border/60 bg-light-primary/[0.03] p-2.5 transition hover:bg-light-primary/[0.05] dark:border-dark-border/60 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]',
                                    canDeleteReply &&
                                      'cursor-pointer active:scale-[0.99]'
                                  )}
                                  onTouchStart={() =>
                                    startLongPress(
                                      reply.id,
                                      true,
                                      canDeleteReply
                                    )
                                  }
                                  onTouchEnd={cancelLongPress}
                                  onTouchMove={cancelLongPress}
                                  onMouseDown={() =>
                                    startLongPress(
                                      reply.id,
                                      true,
                                      canDeleteReply
                                    )
                                  }
                                  onMouseUp={cancelLongPress}
                                  onMouseLeave={cancelLongPress}
                                  onContextMenu={(e) => {
                                    if (canDeleteReply) {
                                      e.preventDefault();
                                      handleDeletePrompt(reply.id, true);
                                    }
                                  }}
                                >
                                  <UserAvatar
                                    src={reply.user.photoURL}
                                    alt={reply.user.name}
                                    username={reply.user.username}
                                    size={30}
                                  />
                                  <div className='flex flex-1 flex-col'>
                                    <div className='flex items-center gap-1.5'>
                                      <span className='text-xs font-bold text-light-primary dark:text-dark-primary'>
                                        {reply.user.name}
                                      </span>
                                      {reply.user.verified && (
                                        <VerifiedBadge className='h-3 w-3' />
                                      )}
                                      <span className='mr-auto text-[11px] text-light-secondary dark:text-dark-secondary'>
                                        {formatDate(reply.createdAt, 'message')}
                                      </span>
                                    </div>

                                    {/* Dedicated "Replying To" Highlight Badge */}
                                    <div className='mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-main-accent-text/90'>
                                      <HeroIcon
                                        className='h-3 w-3 shrink-0 rotate-180 text-main-accent-text'
                                        iconName='ArrowUturnLeftIcon'
                                      />
                                      <span>رد على</span>
                                      <span className='py-0.2 rounded bg-main-accent/15 px-1.5 text-main-accent-text'>
                                        @
                                        {reply.replyTo?.username ||
                                          item.user.username}
                                      </span>
                                    </div>

                                    {/* Reply text body */}
                                    <p className='mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-light-primary dark:text-dark-primary'>
                                      {reply.text}
                                    </p>

                                    {/* Reply action row */}
                                    <div className='mt-2 flex items-center gap-3 text-[11px] font-semibold text-light-secondary dark:text-dark-secondary'>
                                      <button
                                        type='button'
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReplyClick(reply);
                                        }}
                                        className='flex items-center gap-1 transition hover:text-main-accent-text active:scale-95'
                                      >
                                        <HeroIcon
                                          className='h-3 w-3 rotate-180'
                                          iconName='ArrowUturnLeftIcon'
                                        />
                                        <span>رد</span>
                                      </button>

                                      {!!replyLikes.length && (
                                        <span className='flex items-center gap-1 font-medium text-rose-500'>
                                          <HeroIcon
                                            className='h-3 w-3 fill-rose-500 text-rose-500'
                                            solid
                                            iconName='HeartIcon'
                                          />
                                          <span>{replyLikes.length}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Reply Like Heart Button */}
                                  <button
                                    type='button'
                                    onClick={toggleCommentLike(
                                      reply.id,
                                      reply.userLikes
                                    )}
                                    className='p-1 text-light-secondary transition hover:text-rose-500 dark:text-dark-secondary'
                                    aria-label={
                                      isReplyLiked
                                        ? 'إلغاء إعجاب الرد'
                                        : 'إعجاب بالرد'
                                    }
                                  >
                                    <HeroIcon
                                      className={cn(
                                        'h-3.5 w-3.5 transition-transform active:scale-125',
                                        isReplyLiked
                                          ? 'fill-rose-500 text-rose-500'
                                          : 'text-light-secondary dark:text-dark-secondary'
                                      )}
                                      solid={isReplyLiked}
                                      iconName='HeartIcon'
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Emojis Bar */}
            <div className='flex items-center gap-2 overflow-x-auto border-t border-light-border px-4 py-2 dark:border-dark-border'>
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type='button'
                  onClick={() => handleEmojiClick(emoji)}
                  className='rounded-full px-2.5 py-1 text-base transition hover:scale-125 hover:bg-light-line-reply/40 dark:hover:bg-dark-line-reply/40'
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Distinctive Replying Banner Preview */}
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className='flex items-center justify-between overflow-hidden border-t border-main-accent/30 bg-main-accent/10 px-4 py-2 text-xs text-main-accent-text dark:border-main-accent/20'
                >
                  <div className='flex items-center gap-2 truncate'>
                    <HeroIcon
                      className='h-4 w-4 shrink-0 rotate-180 text-main-accent-text'
                      iconName='ArrowUturnLeftIcon'
                    />
                    <span className='truncate'>
                      الرد على <strong>@{replyingTo.username}</strong>
                      {replyingTo.text && (
                        <span className='mx-1 truncate font-normal opacity-75'>
                          &ldquo;{replyingTo.text.slice(0, 35)}
                          {replyingTo.text.length > 35 ? '...' : ''}&rdquo;
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type='button'
                    onClick={cancelReply}
                    className='shrink-0 rounded-full p-1 text-main-accent-text hover:bg-main-accent/20'
                    aria-label='إلغاء الرد'
                  >
                    <HeroIcon className='h-3.5 w-3.5' iconName='XMarkIcon' />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Form */}
            <form
              onSubmit={handleSubmit}
              className='flex items-center gap-2 border-t border-light-border bg-main-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-dark-border'
            >
              <input
                ref={inputRef}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  replyingTo
                    ? `اكتب رداً على @${replyingTo.username}...`
                    : 'أضف تعليقاً لطيفاً...'
                }
                maxLength={280}
                className='flex-1 rounded-full bg-light-line-reply/50 px-4 py-2.5 text-sm text-light-primary outline-none transition focus:ring-2 focus:ring-main-accent dark:bg-dark-line-reply/50 dark:text-dark-primary'
              />
              <Button
                type='submit'
                loading={sending}
                disabled={!comment.trim()}
                className='flex items-center gap-1 rounded-full bg-main-accent px-4 py-2.5 text-sm font-bold text-main-accent-contrast shadow-md transition hover:brightness-95 active:scale-95 disabled:pointer-events-none disabled:opacity-40'
              >
                <span>إرسال</span>
                <HeroIcon
                  className='h-4 w-4 rotate-180'
                  iconName='PaperAirplaneIcon'
                />
              </Button>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Comment / Reply Confirmation Modal - Rendered outside to prevent backdrop clash */}
      <Modal
        open={!!deleteTarget}
        closeModal={() => !isDeleting && setDeleteTarget(null)}
        modalClassName='w-full max-w-sm rounded-3xl border border-light-border bg-main-background p-6 shadow-2xl dark:border-dark-border z-[70]'
      >
        <div onClick={preventBubbling()}>
          <ActionModal
            title={deleteTarget?.isReply ? 'حذف الرد؟' : 'حذف التعليق؟'}
            description={
              deleteTarget?.isReply
                ? 'هل أنت متأكد من رغبتك في حذف هذا الرد؟ سيتم حذف أي ردود تابعة له أيضاً.'
                : 'هل أنت متأكد من رغبتك في حذف هذا التعليق؟ سيتم حذف جميع الردود التابعة له أيضاً.'
            }
            mainBtnLabel='حذف نهائي'
            mainBtnClassName='bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/75 text-white'
            secondaryBtnLabel='إلغاء'
            action={confirmDeleteComment}
            closeModal={() => setDeleteTarget(null)}
            loading={isDeleting}
          />
        </div>
      </Modal>
    </AnimatePresence>
  );
}
