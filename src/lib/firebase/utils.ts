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
import { notifyMentions } from '@lib/mentions';
import {
  formatFileSize,
  inferMediaType,
  maxUploadBytesForType,
  uploadTimeoutMs
} from '@lib/media-limits';
import {
  usersCollection,
  tweetsCollection,
  userStatsCollection,
  userBookmarksCollection,
  storiesCollection
} from './collections';
import type { WithFieldValue, Query } from 'firebase/firestore';
import type { User, EditableUserData } from '@lib/types/user';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';
import type { Bookmark } from '@lib/types/bookmark';
import type { Theme, Accent } from '@lib/types/theme';
import type { Notification } from '@lib/types/notification';
import type { StoryMusic, StoryText, Story } from '@lib/types/story';
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

export async function editTweet(
  tweetId: string,
  userId: string,
  text: string,
  options?: { allowEmpty?: boolean }
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed && !options?.allowEmpty)
    throw new Error('لا يمكن حفظ منشور فارغ');
  if (trimmed.length > 1000) throw new Error('النص أطول من المسموح');

  const tweetRef = doc(tweetsCollection, tweetId);
  const snap = await getDoc(tweetRef);
  const data = snap.data();
  if (!data) throw new Error('المنشور غير موجود');
  if (data.createdBy !== userId) throw new Error('لا يمكنك تعديل هذا المنشور');

  await updateDoc(tweetRef, {
    text: trimmed || null,
    edited: true,
    editedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await notifyMentions('post', tweetId);
}

export async function editReel(
  reelId: string,
  userId: string,
  caption: string
): Promise<void> {
  const trimmed = caption.trim();
  if (trimmed.length > 1000) throw new Error('الوصف أطول من المسموح');

  const reelRef = doc(storiesCollection, reelId);
  const snap = await getDoc(reelRef);
  const data = snap.data();
  if (!data) throw new Error('الريل غير موجود');
  if (data.userId !== userId) throw new Error('لا يمكنك تعديل هذا الريل');

  await updateDoc(reelRef, {
    caption: trimmed || null,
    edited: true,
    editedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  } as Partial<WithFieldValue<Story>>);
  await notifyMentions('reel', reelId);
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

/** Builds a bounded-size poster without ever blocking the actual upload. */
async function createVideoThumbnail(
  file: File & { id: string }
): Promise<VideoThumbnail | null> {
  if (!inferMediaType(file.name, file.type).startsWith('video/')) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const timeout = window.setTimeout(() => finish(null), 6_000);

    const cleanup = (): void => {
      window.clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      video.remove();
    };
    const finish = (value: VideoThumbnail | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, Math.max(0.1, video.duration * 0.1));
    };
    video.onseeked = () => {
      try {
        const sourceWidth = video.videoWidth || 720;
        const sourceHeight = video.videoHeight || 1280;
        const scale = Math.min(1, 720 / sourceWidth, 1280 / sourceHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(2, Math.round(sourceWidth * scale));
        canvas.height = Math.max(2, Math.round(sourceHeight * scale));
        canvas
          .getContext('2d')
          ?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) =>
            finish(
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
            ),
          'image/jpeg',
          0.82
        );
      } catch {
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

function putMediaFile(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.timeout = uploadTimeoutMs(file.size);
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress((event.loaded / event.total) * 100);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else reject(new Error(`upload_http_${request.status}`));
    };
    request.onerror = () => reject(new Error('upload_network'));
    request.ontimeout = () => reject(new Error('upload_timeout'));
    request.onabort = () => reject(new Error('upload_aborted'));
    request.send(file);
  });
}

async function putMediaFileWithRetry(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await putMediaFile(uploadUrl, file, contentType, onProgress);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 0)
        await new Promise((resolve) => window.setTimeout(resolve, 700));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('upload_failed');
}

export async function uploadImages(
  userId: string,
  files: FilesWithId,
  onProgress?: UploadProgressHandler
): Promise<ImagesPreview | null> {
  if (!files.length) return null;

  for (const file of files) {
    const mediaType = inferMediaType(file.name, file.type);
    if (!mediaType) throw new Error(`صيغة الملف ${file.name} غير مدعومة`);
    const maxBytes = maxUploadBytesForType(mediaType);
    if (file.size <= 0) throw new Error(`الملف ${file.name} فارغ`);
    if (file.size > maxBytes)
      throw new Error(
        `حجم ${file.name} هو ${formatFileSize(
          file.size
        )} والحد الأقصى ${formatFileSize(maxBytes)}`
      );
  }

  const thumbnails = (
    await Promise.all(files.map(createVideoThumbnail))
  ).filter((item): item is VideoThumbnail => item !== null);
  const uploadInput = [
    ...files,
    ...thumbnails.map(({ file }) => file)
  ] as FilesWithId;
  const uploadedBytes = new Array<number>(uploadInput.length).fill(0);
  const totalBytes = uploadInput.reduce((sum, file) => sum + file.size, 0);
  const report = (index: number, percent: number): void => {
    const nextBytes =
      uploadInput[index].size * (Math.min(Math.max(percent, 0), 100) / 100);
    uploadedBytes[index] = Math.max(uploadedBytes[index], nextBytes);
    onProgress?.(
      totalBytes > 0
        ? Math.min(
            100,
            Math.round(
              (uploadedBytes.reduce((sum, bytes) => sum + bytes, 0) /
                totalBytes) *
                100
            )
          )
        : 0
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
      files: uploadInput.map(({ id, name, type, size }) => ({
        id,
        name,
        type: inferMediaType(name, type),
        size
      }))
    })
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error || 'تعذر تجهيز رفع الوسائط');
  }

  const { files: uploadFiles } = (await response.json()) as {
    files: {
      id: string;
      alt: string;
      type: string;
      size: number;
      uploadUrl: string;
      publicUrl: string;
    }[];
  };
  if (!uploadFiles?.length || uploadFiles.length !== uploadInput.length)
    throw new Error('استجابة رفع الوسائط غير صالحة');

  try {
    await Promise.all(
      uploadFiles.map(({ uploadUrl, type }, index) =>
        putMediaFileWithRetry(uploadUrl, uploadInput[index], type, (percent) =>
          report(index, percent)
        )
      )
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'upload_timeout')
      throw new Error('انتهت مهلة الرفع. تحقق من الاتصال وأعد المحاولة');
    if (code === 'upload_network')
      throw new Error('انقطع الاتصال أثناء الرفع. أعد المحاولة');
    throw new Error('فشل رفع الملف إلى التخزين. أعد المحاولة');
  }

  const uploadedById = new Map(uploadFiles.map((item) => [item.id, item]));
  const posterBySource = new Map(
    thumbnails.map(({ sourceId, file }) => [
      sourceId,
      uploadedById.get(file.id)?.publicUrl ?? null
    ])
  );
  const results = files.map(({ id, name }) => {
    const uploaded = uploadedById.get(id);
    if (!uploaded) throw new Error('ملف مفقود من استجابة الرفع');
    return {
      id,
      src: uploaded.publicUrl,
      alt: name,
      type: uploaded.type,
      thumbnail: posterBySource.get(id) ?? null
    };
  });

  // لا نؤخر نجاح الرفع بعملية FFmpeg الخادمية. مشغلات الفيديو تطلب نسخة
  // متوافقة فقط عند فشل الجهاز في تشغيل المصدر الأصلي.
  return results;
}

export async function manageReply(
  type: 'increment' | 'decrement',
  tweetId: string,
  replyId?: string
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
          tweetId: replyId ?? tweetId,
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

  // الكتابة تتم عبر الخادم بعد التحقق من أن الإعجاب/المتابعة/الرد حدث
  // فعليًا. هذا يمنع أي عميل معدل من حقن إشعارات في حسابات الآخرين.
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== notification.fromUserId) return;
    const token = await currentUser.getIdToken();
    await fetch('/api/notifications/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        ...notification,
        toUserId,
        context
      })
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
  music?: StoryMusic | null,
  texts?: StoryText[] | null
): Promise<void> {
  if (!files.length) return;

  const images = await uploadImages(userId, files);

  if (!images) return;

  const batch = writeBatch(db);
  const userRef = doc(usersCollection, userId);
  const now = serverTimestamp();

  const expiresAt = getStoryExpiration();
  const storyIds: string[] = [];

  images.forEach((image) => {
    const storyRef = doc(storiesCollection);
    storyIds.push(storyRef.id);
    const storyData: WithFieldValue<Story> = {
      id: storyRef.id,
      userId,
      images: [image],
      caption: caption?.trim() || null,
      color,
      duration: durations?.[image.id] ?? DEFAULT_STORY_DURATION_MS,
      music: music ?? null,
      texts: texts?.length ? texts : null,
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
  await Promise.all(storyIds.map((id) => notifyMentions('story', id)));
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
  music?: { src: string; name: string } | null,
  onProgress?: UploadProgressHandler
): Promise<void> {
  if (!files.length) return;

  const images = await uploadImages(userId, files, onProgress);

  if (!images) return;

  const batch = writeBatch(db);
  const userRef = doc(usersCollection, userId);
  const now = serverTimestamp();

  const expiresAt = getReelExpiration();
  const reelIds: string[] = [];

  images.forEach((image) => {
    const reelRef = doc(storiesCollection);
    reelIds.push(reelRef.id);
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
  await Promise.all(reelIds.map((id) => notifyMentions('reel', id)));
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
        context: 'reel',
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
  await notifyMentions('post', docRef.id);

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
          storyId: reelId,
          context: 'reel',
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
