import {
  doc,
  query,
  where,
  limit,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  increment,
  writeBatch,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  getCountFromServer,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './app';
import { normalizeVideo } from '@lib/media-normalize';
import { sendPushNotification } from '@lib/push';
import {
  usersCollection,
  tweetsCollection,
  userStatsCollection,
  userBookmarksCollection,
  notificationsCollection,
  storiesCollection
} from './collections';
import type { WithFieldValue, Query } from 'firebase/firestore';
import type { User, EditableUserData } from '@lib/types/user';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';
import type { Bookmark } from '@lib/types/bookmark';
import type { Theme, Accent } from '@lib/types/theme';
import type { Notification } from '@lib/types/notification';
import type { Story } from '@lib/types/story';
import { getTimestampMillis } from '@lib/date';
import type { Tweet } from '@lib/types/tweet';

export async function checkUsernameAvailability(
  username: string
): Promise<boolean> {
  const { empty } = await getDocs(
    query(usersCollection, where('username', '==', username), limit(1))
  );
  return empty;
}

export async function getCollectionCount<T>(
  collection: Query<T>
): Promise<number> {
  const snapshot = await getCountFromServer(collection);
  return snapshot.data().count;
}

export async function updateUserData(
  userId: string,
  userData: EditableUserData
): Promise<void> {
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    ...userData,
    updatedAt: serverTimestamp()
  });
}

export async function completeOnboarding(
  userId: string,
  data: {
    photoURL?: string;
    coverPhotoURL?: string | null;
    gender?: 'male' | 'female' | null;
  }
): Promise<void> {
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    ...data,
    onboarded: true,
    updatedAt: serverTimestamp()
  });
}

export async function updateUserTheme(
  userId: string,
  themeData: { theme?: Theme; accent?: Accent }
): Promise<void> {
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, { ...themeData });
}

export async function updateUsername(
  userId: string,
  username?: string
): Promise<void> {
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    ...(username && { username }),
    updatedAt: serverTimestamp()
  });
}

export async function manageBlock(
  type: 'block' | 'unblock',
  userId: string,
  targetUserId: string
): Promise<void> {
  if (!userId || !targetUserId || userId === targetUserId) return;
  await updateDoc(doc(usersCollection, userId), {
    blockedUsers:
      type === 'block' ? arrayUnion(targetUserId) : arrayRemove(targetUserId),
    updatedAt: serverTimestamp()
  });
}

export async function managePinnedTweet(
  type: 'pin' | 'unpin',
  userId: string,
  tweetId: string
): Promise<void> {
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    updatedAt: serverTimestamp(),
    pinnedTweet: type === 'pin' ? tweetId : null
  });
}

export async function manageFollow(
  type: 'follow' | 'unfollow',
  userId: string,
  targetUserId: string
): Promise<void> {
  const batch = writeBatch(db);

  const userDocRef = doc(usersCollection, userId);
  const targetUserDocRef = doc(usersCollection, targetUserId);

  if (type === 'follow') {
    batch.update(userDocRef, {
      following: arrayUnion(targetUserId),
      updatedAt: serverTimestamp()
    });
    batch.update(targetUserDocRef, {
      followers: arrayUnion(userId),
      updatedAt: serverTimestamp()
    });
  } else {
    batch.update(userDocRef, {
      following: arrayRemove(targetUserId),
      updatedAt: serverTimestamp()
    });
    batch.update(targetUserDocRef, {
      followers: arrayRemove(userId),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();

  if (type === 'follow')
    await createNotification(targetUserId, {
      type: 'follow',
      fromUserId: userId,
      toUserId: targetUserId,
      read: false
    });
}

export async function removeTweet(tweetId: string): Promise<void> {
  const idsToDelete = new Set<string>([tweetId]);
  let currentBatch = [tweetId];

  try {
    // Recursively collect all descendant replies (both parent.id and replyTo.id)
    while (currentBatch.length > 0) {
      const nextBatch: string[] = [];

      for (let i = 0; i < currentBatch.length; i += 10) {
        const chunk = currentBatch.slice(i, i + 10);
        const [parentSnap, replyToSnap] = await Promise.all([
          getDocs(query(tweetsCollection, where('parent.id', 'in', chunk))),
          getDocs(query(tweetsCollection, where('replyTo.id', 'in', chunk)))
        ]);

        parentSnap.docs.forEach((d) => {
          if (!idsToDelete.has(d.id)) {
            idsToDelete.add(d.id);
            nextBatch.push(d.id);
          }
        });

        replyToSnap.docs.forEach((d) => {
          if (!idsToDelete.has(d.id)) {
            idsToDelete.add(d.id);
            nextBatch.push(d.id);
          }
        });
      }

      currentBatch = nextBatch;
    }
  } catch (err) {
    console.error('Error finding cascade replies to delete:', err);
  }

  // Delete all collected documents in atomic batches of up to 450
  const allIds = Array.from(idsToDelete);
  for (let i = 0; i < allIds.length; i += 450) {
    const batch = writeBatch(db);
    allIds.slice(i, i + 450).forEach((id) => {
      batch.delete(doc(tweetsCollection, id));
    });
    await batch.commit();
  }
}

export type UploadProgressHandler = (percent: number) => void;

type VideoThumbnail = { sourceId: string; file: File & { id: string } };

/** Builds a real poster before upload so WebView never has to guess a video frame. */
async function createVideoThumbnail(
  file: File & { id: string }
): Promise<VideoThumbnail | null> {
  if (!file.type.startsWith('video/')) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const cleanup = (): void => {
      URL.revokeObjectURL(url);
      video.remove();
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, Math.max(0.1, video.duration * 0.1));
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        canvas
          .getContext('2d')
          ?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(
              blob
                ? {
                    sourceId: file.id,
                    file: Object.assign(
                      new File([blob], `poster-${file.id}.jpg`, {
                        type: 'image/jpeg'
                      }),
                      { id: `poster-${file.id}` }
                    )
                  }
                : null
            );
          },
          'image/jpeg',
          0.86
        );
      } catch {
        cleanup();
        resolve(null);
      }
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });
}

export async function uploadImages(
  userId: string,
  files: FilesWithId,
  onProgress?: UploadProgressHandler
): Promise<ImagesPreview | null> {
  if (!files.length) return null;

  const thumbnails = (
    await Promise.all(files.map(createVideoThumbnail))
  ).filter((item): item is VideoThumbnail => item !== null);
  const uploadInput = [
    ...files,
    ...thumbnails.map(({ file }) => file)
  ] as FilesWithId;
  const perFile = new Array<number>(uploadInput.length).fill(0);
  const report = (index: number, percent: number): void => {
    perFile[index] = Math.min(Math.round(percent), 100);
    onProgress?.(
      Math.round(perFile.reduce((acc, p) => acc + p, 0) / uploadInput.length)
    );
  };

  // Cloudflare R2 is the only media backend. A failed signed upload must be
  // surfaced to the UI rather than silently writing to a second provider.
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('يجب تسجيل الدخول قبل رفع الوسائط');

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      files: uploadInput.map(({ id, name, type }) => ({ id, name, type }))
    })
  });
  if (!response.ok) throw new Error('تعذر تجهيز رفع الوسائط');

  const { files: uploadFiles } = (await response.json()) as {
    files: {
      id: string;
      alt: string;
      type: string;
      uploadUrl: string;
      publicUrl: string;
    }[];
  };
  if (!uploadFiles?.length || uploadFiles.length !== uploadInput.length)
    throw new Error('استجابة رفع الوسائط غير صالحة');

  await Promise.all(
    uploadFiles.map(({ uploadUrl }, index) =>
      fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadInput[index].type },
        body: uploadInput[index]
      }).then((result) => {
        if (!result.ok)
          throw new Error(`Failed to upload ${uploadInput[index].name}`);
        report(index, 100);
      })
    )
  );

  const uploadedById = new Map(uploadFiles.map((item) => [item.id, item]));
  const posterBySource = new Map(
    thumbnails.map(({ sourceId, file }) => [
      sourceId,
      uploadedById.get(file.id)?.publicUrl ?? null
    ])
  );
  const results = files.map(({ id, name, type }) => {
    const uploaded = uploadedById.get(id);
    if (!uploaded) throw new Error('ملف مفقود من استجابة الرفع');
    return {
      id,
      src: uploaded.publicUrl,
      alt: name,
      type,
      thumbnail: posterBySource.get(id) ?? null
    };
  });

  // Raw phone uploads (HEVC, H.264 High@L5.2, .mov, non-faststart MP4) decode
  // fine on desktop Chrome but fail on some mobile hardware decoders,
  // which caps at H.264 level 4.x — that is the gray box bug in the app.
  // Re-encode every video server-side so all devices can play it.
  const normalized = await Promise.all(
    results.map(async (item) => {
      if (!item.type?.startsWith('video/')) return item;
      const fixed = await normalizeVideo(item.src);
      return fixed ? { ...item, src: fixed } : item;
    })
  );

  return normalized;
}

export async function manageReply(
  type: 'increment' | 'decrement',
  tweetId: string
): Promise<void> {
  const tweetRef = doc(tweetsCollection, tweetId);

  try {
    const tweetSnap = await getDoc(tweetRef);
    const tweetOwnerId = tweetSnap.data()?.createdBy;

    await updateDoc(tweetRef, {
      userReplies: increment(type === 'increment' ? 1 : -1),
      updatedAt: serverTimestamp()
    });

    const currentUserId = auth.currentUser?.uid;

    if (
      type === 'increment' &&
      tweetOwnerId &&
      currentUserId &&
      tweetOwnerId !== currentUserId
    )
      await createNotification(
        tweetOwnerId,
        {
          type: 'reply',
          fromUserId: currentUserId,
          toUserId: tweetOwnerId,
          tweetId,
          read: false
        },
        'post'
      );
  } catch {
    // do nothing, because parent tweet was already deleted
  }
}

export async function manageTotalTweets(
  type: 'increment' | 'decrement',
  userId: string
): Promise<void> {
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    totalTweets: increment(type === 'increment' ? 1 : -1),
    updatedAt: serverTimestamp()
  });
}

export async function manageTotalReplies(
  type: 'increment' | 'decrement',
  userId: string
): Promise<void> {
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    totalReplies: increment(type === 'increment' ? 1 : -1),
    updatedAt: serverTimestamp()
  });
}

export async function manageTotalPhotos(
  type: 'increment' | 'decrement',
  userId: string
): Promise<void> {
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    totalPhotos: increment(type === 'increment' ? 1 : -1),
    updatedAt: serverTimestamp()
  });
}

export function manageRetweet(
  type: 'retweet' | 'unretweet',
  userId: string,
  tweetId: string
) {
  return async (): Promise<void> => {
    const batch = writeBatch(db);

    const tweetRef = doc(tweetsCollection, tweetId);
    const userStatsRef = doc(userStatsCollection(userId), 'stats');

    const tweetSnap = await getDoc(tweetRef);
    const tweetOwnerId = tweetSnap.data()?.createdBy;

    if (type === 'retweet') {
      batch.update(tweetRef, {
        userRetweets: arrayUnion(userId),
        updatedAt: serverTimestamp()
      });
      batch.set(
        userStatsRef,
        {
          tweets: arrayUnion(tweetId),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } else {
      batch.update(tweetRef, {
        userRetweets: arrayRemove(userId),
        updatedAt: serverTimestamp()
      });
      batch.set(
        userStatsRef,
        {
          tweets: arrayRemove(tweetId),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    await batch.commit();

    if (type === 'retweet' && tweetOwnerId && tweetOwnerId !== userId)
      await createNotification(
        tweetOwnerId,
        {
          type: 'retweet',
          fromUserId: userId,
          toUserId: tweetOwnerId,
          tweetId,
          read: false
        },
        'post'
      );
  };
}

export function manageLike(
  type: 'like' | 'unlike',
  userId: string,
  tweetId: string
) {
  return async (): Promise<void> => {
    const batch = writeBatch(db);

    const userStatsRef = doc(userStatsCollection(userId), 'stats');
    const tweetRef = doc(tweetsCollection, tweetId);

    const tweetSnap = await getDoc(tweetRef);
    const tweetOwnerId = tweetSnap.data()?.createdBy;

    if (type === 'like') {
      batch.update(tweetRef, {
        userLikes: arrayUnion(userId),
        updatedAt: serverTimestamp()
      });
      batch.set(
        userStatsRef,
        {
          likes: arrayUnion(tweetId),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } else {
      batch.update(tweetRef, {
        userLikes: arrayRemove(userId),
        updatedAt: serverTimestamp()
      });
      batch.set(
        userStatsRef,
        {
          likes: arrayRemove(tweetId),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    await batch.commit();

    if (type === 'like' && tweetOwnerId && tweetOwnerId !== userId)
      await createNotification(
        tweetOwnerId,
        {
          type: 'like',
          fromUserId: userId,
          toUserId: tweetOwnerId,
          tweetId,
          read: false
        },
        'post'
      );
  };
}

export async function manageBookmark(
  type: 'bookmark' | 'unbookmark',
  userId: string,
  tweetId: string
): Promise<void> {
  const bookmarkRef = doc(userBookmarksCollection(userId), tweetId);

  if (type === 'bookmark') {
    const bookmarkData: WithFieldValue<Bookmark> = {
      id: tweetId,
      createdAt: serverTimestamp()
    };
    await setDoc(bookmarkRef, bookmarkData);
  } else await deleteDoc(bookmarkRef);
}

export async function clearAllBookmarks(userId: string): Promise<void> {
  const bookmarksRef = userBookmarksCollection(userId);
  const bookmarksSnapshot = await getDocs(bookmarksRef);

  const batch = writeBatch(db);

  bookmarksSnapshot.forEach(({ ref }) => batch.delete(ref));

  await batch.commit();
}

export async function createNotification(
  toUserId: string,
  notification: Omit<Notification, 'id' | 'createdAt'>,
  context?: 'post' | 'reel' | 'story'
): Promise<void> {
  if (!toUserId || toUserId === notification.fromUserId) return;

  // Notification delivery is best-effort — a failing notification write
  // (e.g. exhausted Spark write quota) must never break the original
  // like/reply/retweet/follow action that triggered it.
  try {
    const notificationsRef = notificationsCollection(toUserId);
    const notificationRef = doc(notificationsRef);

    const notificationData: WithFieldValue<Notification> = {
      ...notification,
      id: notificationRef.id,
      createdAt: serverTimestamp()
    };

    await setDoc(notificationRef, notificationData);

    sendPushNotification({
      kind: 'activity',
      toUserId,
      type: notification.type,
      context,
      tweetId: notification.tweetId ?? null,
      storyId: notification.storyId ?? null,
      storyUserId: notification.storyUserId ?? null
    });
  } catch (error) {
    console.warn('notification delivery skipped:', error);
  }
}

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function getStoryExpiration(): Timestamp {
  return Timestamp.fromMillis(Date.now() + STORY_LIFETIME_MS);
}

const DEFAULT_STORY_DURATION_MS = 15000;

export async function uploadStory(
  userId: string,
  files: FilesWithId,
  color: string,
  caption: string | null,
  durations?: Record<string, number>,
  music?: { src: string; name: string } | null
): Promise<void> {
  if (!files.length) return;

  const images = await uploadImages(userId, files);

  if (!images) return;

  const batch = writeBatch(db);
  const userRef = doc(usersCollection, userId);
  const now = serverTimestamp();

  const expiresAt = getStoryExpiration();

  images.forEach((image) => {
    const storyRef = doc(storiesCollection);
    const storyData: WithFieldValue<Story> = {
      id: storyRef.id,
      userId,
      images: [image],
      caption: caption?.trim() || null,
      color,
      duration: durations?.[image.id] ?? DEFAULT_STORY_DURATION_MS,
      music: music ?? null,
      likes: [],
      views: [],
      kind: 'story',
      createdAt: now,
      expiresAt,
      updatedAt: null
    };
    batch.set(storyRef, storyData);
  });

  batch.update(userRef, {
    storyColor: color,
    lastStoryAt: now,
    updatedAt: now
  });

  await batch.commit();
}

// Reels live in the same `stories` collection but are tagged with kind:'reel'
// so the stories bar / viewer never shows them and the /reels feed never shows
// plain stories. Reels also use a much longer lifetime (30 days) so the feed
// does not empty out within a day.
const REEL_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function getReelExpiration(): Timestamp {
  return Timestamp.fromMillis(Date.now() + REEL_LIFETIME_MS);
}

export async function uploadReel(
  userId: string,
  files: FilesWithId,
  color: string,
  caption: string | null,
  durations?: Record<string, number>,
  music?: { src: string; name: string } | null
): Promise<void> {
  if (!files.length) return;

  const images = await uploadImages(userId, files);

  if (!images) return;

  const batch = writeBatch(db);
  const userRef = doc(usersCollection, userId);
  const now = serverTimestamp();

  const expiresAt = getReelExpiration();

  images.forEach((image) => {
    const reelRef = doc(storiesCollection);
    const reelData: WithFieldValue<Story> = {
      id: reelRef.id,
      userId,
      images: [image],
      caption: caption?.trim() || null,
      color,
      duration: durations?.[image.id] ?? DEFAULT_STORY_DURATION_MS,
      music: music ?? null,
      likes: [],
      views: [],
      kind: 'reel',
      createdAt: now,
      expiresAt,
      updatedAt: null
    };
    batch.set(reelRef, reelData);
  });

  batch.update(userRef, {
    storyColor: color,
    updatedAt: now
  });

  await batch.commit();
}

export async function viewStory(
  storyId: string,
  viewerId: string,
  storyUserId: string
): Promise<void> {
  if (!storyId || !viewerId) return;

  const storyRef = doc(storiesCollection, storyId);
  const viewerRef = doc(usersCollection, viewerId);

  const batch = writeBatch(db);

  batch.update(storyRef, {
    views: arrayUnion(viewerId),
    updatedAt: serverTimestamp()
  } as Partial<WithFieldValue<Story>>);

  batch.update(viewerRef, {
    [`storyViews.${storyUserId}`]: serverTimestamp(),
    updatedAt: serverTimestamp()
  } as Partial<WithFieldValue<User>>);

  await batch.commit();
}

export async function likeStory(
  storyId: string,
  userId: string,
  storyUserId: string,
  liked: boolean
): Promise<void> {
  const storyRef = doc(storiesCollection, storyId);

  await updateDoc(storyRef, {
    likes: liked ? arrayUnion(userId) : arrayRemove(userId),
    updatedAt: serverTimestamp()
  } as Partial<WithFieldValue<Story>>);

  if (liked && storyUserId && storyUserId !== userId)
    await createNotification(
      storyUserId,
      {
        type: 'storyLike',
        fromUserId: userId,
        toUserId: storyUserId,
        storyId,
        storyUserId,
        read: false
      },
      'story'
    );
}

export async function deleteStory(
  storyId: string,
  userId: string
): Promise<void> {
  const storyRef = doc(storiesCollection, storyId);
  const storySnap = await getDoc(storyRef);
  const storyData = storySnap.data();

  if (!storyData || storyData.userId !== userId) return;

  await deleteDoc(storyRef);

  const allStoriesSnap = await getDocs(
    query(storiesCollection, where('userId', '==', userId))
  );

  const nowMs = Date.now();
  const latest = allStoriesSnap.docs
    .map((s) => s.data())
    .filter((s) => {
      if (s.kind === 'reel') return false;
      const createdMs = getTimestampMillis(s.createdAt);
      let expiresMs = getTimestampMillis(s.expiresAt);
      if (!expiresMs && createdMs) expiresMs = createdMs + 24 * 60 * 60 * 1000;
      return (
        expiresMs > nowMs ||
        (createdMs > 0 && nowMs - createdMs < 24 * 60 * 60 * 1000)
      );
    })
    .sort(
      (a, b) =>
        getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
    )[0];

  const userRef = doc(usersCollection, userId);
  if (!latest) {
    await updateDoc(userRef, {
      lastStoryAt: null,
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(userRef, {
      lastStoryAt: latest.createdAt,
      updatedAt: serverTimestamp()
    });
  }
}

export async function setStoryColor(
  userId: string,
  color: string
): Promise<void> {
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    storyColor: color,
    updatedAt: serverTimestamp()
  });
}

// Reels are full-screen vertical clips built on top of the stories
// collection (which already holds media, likes and views). These helpers
// power the /reels page interactions: like (with notifications), views,
// comments (stored as replies in the tweets collection) and deletion.

export async function likeReel(
  reelId: string,
  userId: string,
  reelOwnerId: string,
  liked: boolean
): Promise<void> {
  const reelRef = doc(storiesCollection, reelId);

  await updateDoc(reelRef, {
    likes: liked ? arrayUnion(userId) : arrayRemove(userId),
    updatedAt: serverTimestamp()
  } as Partial<WithFieldValue<Story>>);

  if (liked && reelOwnerId && reelOwnerId !== userId)
    await createNotification(
      reelOwnerId,
      {
        type: 'storyLike',
        fromUserId: userId,
        toUserId: reelOwnerId,
        storyId: reelId,
        storyUserId: reelOwnerId,
        read: false
      },
      'reel'
    );
}

export async function viewReel(
  reelId: string,
  viewerId: string
): Promise<void> {
  if (!reelId || !viewerId) return;

  const reelRef = doc(storiesCollection, reelId);

  await updateDoc(reelRef, {
    views: arrayUnion(viewerId),
    updatedAt: serverTimestamp()
  } as Partial<WithFieldValue<Story>>);
}

export async function deleteReel(
  reelId: string,
  userId: string
): Promise<void> {
  await deleteStory(reelId, userId);
}

// A reel comment is persisted as a reply tweet whose parent points back to
// the reel so it shows up in the comment sheet and counts toward replies.
export async function addReelComment(
  reelId: string,
  reelOwnerId: string,
  userId: string,
  text: string,
  replyTo?: {
    id: string;
    username: string;
    name?: string;
    text?: string | null;
  } | null
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('لا يمكن إرسال تعليق فارغ');

  const tweetData: WithFieldValue<Omit<Tweet, 'id'>> = {
    text: trimmed,
    parent: { id: reelId, username: reelOwnerId || '' },
    replyTo: replyTo ?? null,
    images: null,
    userLikes: [],
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: null,
    userReplies: 0,
    userRetweets: []
  };

  const docRef = await addDoc(tweetsCollection, tweetData);

  // Safely update user total tweets without blocking
  try {
    const userRef = doc(usersCollection, userId);
    await setDoc(
      userRef,
      {
        totalReplies: increment(1),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch {
    // Non-blocking
  }

  // Notify reel owner
  if (reelOwnerId && reelOwnerId !== userId) {
    try {
      await createNotification(
        reelOwnerId,
        {
          type: 'reply',
          fromUserId: userId,
          toUserId: reelOwnerId,
          tweetId: docRef.id,
          read: false
        },
        'reel'
      );
    } catch {
      // Non-blocking
    }
  }

  return docRef.id;
}

export async function deleteReelComment(
  commentId: string,
  userId: string
): Promise<void> {
  await removeTweet(commentId);

  try {
    const userRef = doc(usersCollection, userId);
    await setDoc(
      userRef,
      {
        totalReplies: increment(-1),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch {
    // Non-blocking
  }
}
