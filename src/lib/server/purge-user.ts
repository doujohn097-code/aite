import { adminAuth, adminFirestore } from '@lib/firebase-admin';
import { deleteUserMedia } from '@lib/r2';
import type { firestore } from 'firebase-admin';

/** تقرير موجز عمّا تم حذفه */
export type PurgeReport = {
  tweets: number;
  replies: number;
  stories: number;
  conversations: number;
  notifications: number;
  likesRemoved: number;
  followsRemoved: number;
  mediaFiles: number;
};

const BATCH_LIMIT = 400;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    result.push(items.slice(i, i + size));
  return result;
}

async function deleteRefs(
  db: firestore.Firestore,
  refs: firestore.DocumentReference[]
): Promise<number> {
  for (const group of chunk(refs, BATCH_LIMIT)) {
    const batch = db.batch();
    group.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return refs.length;
}

async function removeFromArray(
  db: firestore.Firestore,
  collectionName: string,
  field: string,
  userId: string
): Promise<number> {
  const snapshot = await db
    .collection(collectionName)
    .where(field, 'array-contains', userId)
    .get();

  if (snapshot.empty) return 0;

  const { FieldValue } = (await import('firebase-admin')).firestore;

  for (const group of chunk(snapshot.docs, BATCH_LIMIT)) {
    const batch = db.batch();
    group.forEach((doc) =>
      batch.update(doc.ref, { [field]: FieldValue.arrayRemove(userId) })
    );
    await batch.commit();
  }

  return snapshot.size;
}

/**
 * حذف شامل لكل ما يخصّ المستخدم:
 * منشوراته وردوده، ردود الآخرين على منشوراته، إعجاباته وإعادات نشره،
 * قصصه وريلزه، محادثاته ورسائلها، إشعاراته والإشعارات التي سبّبها،
 * متابعاته ومتابعيه، وثيقته وكل مجموعاتها الفرعية، ثم حساب المصادقة.
 */
export async function purgeUserData(userId: string): Promise<PurgeReport> {
  if (!adminFirestore) throw new Error('admin_not_configured');

  const db = adminFirestore;

  const report: PurgeReport = {
    tweets: 0,
    replies: 0,
    stories: 0,
    conversations: 0,
    notifications: 0,
    likesRemoved: 0,
    followsRemoved: 0,
    mediaFiles: 0
  };

  // 1) منشورات المستخدم (والردود التي كتبها)
  const ownTweets = await db
    .collection('tweets')
    .where('createdBy', '==', userId)
    .get();

  const ownTweetIds = ownTweets.docs.map((doc) => doc.id);

  report.tweets = await deleteRefs(
    db,
    ownTweets.docs.map((doc) => doc.ref)
  );

  // 2) ردود الآخرين على منشوراته
  for (const ids of chunk(ownTweetIds, 10)) {
    try {
      const replies = await db
        .collection('tweets')
        .where('parent.id', 'in', ids)
        .get();

      report.replies += await deleteRefs(
        db,
        replies.docs.map((doc) => doc.ref)
      );
    } catch {
      // فهرس غير متاح — نتجاهل ونكمل
    }
  }

  // 3) إعجاباته وإعادات نشره في منشورات الآخرين
  for (const field of ['userLikes', 'userRetweets']) {
    try {
      report.likesRemoved += await removeFromArray(db, 'tweets', field, userId);
    } catch {
      // تجاهل
    }
  }

  // 4) القصص والريلز الخاصة به
  try {
    const stories = await db
      .collection('stories')
      .where('userId', '==', userId)
      .get();

    report.stories = await deleteRefs(
      db,
      stories.docs.map((doc) => doc.ref)
    );
  } catch {
    // تجاهل
  }

  // 5) أثره في قصص الآخرين (إعجاب / مشاهدة)
  for (const field of ['likes', 'views', 'userRetweets']) {
    try {
      await removeFromArray(db, 'stories', field, userId);
    } catch {
      // تجاهل
    }
  }

  // 6) المحادثات ورسائلها بالكامل
  try {
    const conversations = await db
      .collection('conversations')
      .where('participants', 'array-contains', userId)
      .get();

    for (const doc of conversations.docs) {
      try {
        await db.recursiveDelete(doc.ref);
      } catch {
        await doc.ref.delete().catch(() => undefined);
      }
      report.conversations += 1;
    }
  } catch {
    // تجاهل
  }

  // 7) الإشعارات التي سبّبها لدى الآخرين
  for (const field of ['fromUserId', 'toUserId']) {
    try {
      const notifications = await db
        .collectionGroup('notifications')
        .where(field, '==', userId)
        .get();

      report.notifications += await deleteRefs(
        db,
        notifications.docs.map((doc) => doc.ref)
      );
    } catch {
      // يتطلب فهرس مجموعة — يتم حذف إشعاراته الخاصة مع وثيقته على أي حال
    }
  }

  // 8) إزالته من قوائم المتابعة والمتابعين
  for (const field of ['following', 'followers']) {
    try {
      report.followsRemoved += await removeFromArray(
        db,
        'users',
        field,
        userId
      );
    } catch {
      // تجاهل
    }
  }

  // 9) وثيقة المستخدم وكل مجموعاتها الفرعية (إشعارات، مرجعيات، إحصاءات)
  const userRef = db.collection('users').doc(userId);

  try {
    await db.recursiveDelete(userRef);
  } catch {
    await userRef.delete().catch(() => undefined);
  }

  // 10) اسم المستخدم المحجوز إن وُجد
  try {
    const usernames = await db
      .collection('usernames')
      .where('userId', '==', userId)
      .get();

    await deleteRefs(
      db,
      usernames.docs.map((doc) => doc.ref)
    );
  } catch {
    // مجموعة اختيارية
  }

  // 11) ملفات الوسائط في Cloudflare R2
  try {
    report.mediaFiles = await deleteUserMedia(userId);
  } catch (error) {
    console.error('r2 purge failed:', error);
  }

  // 12) حساب المصادقة
  if (adminAuth) await adminAuth.deleteUser(userId).catch(() => undefined);

  return report;
}
