import { functions, firestore, regionalFunctions } from './lib/utils';
import { tweetConverter, bookmarkConverter } from './types';
import type { Tweet } from './types';

export const normalizeStats = regionalFunctions.firestore
  .document('tweets/{tweetId}')
  .onDelete(async (snapshot): Promise<void> => {
    const tweetId = snapshot.id;
    const tweetData = snapshot.data() as Tweet;

    functions.logger.info(`Normalizing stats from tweet ${tweetId}`);

    const { userRetweets, userLikes } = tweetData;

    // Guard against missing arrays: a malformed or legacy document must not
    // crash the whole trigger with "undefined is not iterable".
    const usersStatsToDelete = new Set([
      ...(Array.isArray(userRetweets) ? userRetweets : []),
      ...(Array.isArray(userLikes) ? userLikes : [])
    ]);

    const batch = firestore().batch();

    if (usersStatsToDelete.size > 0) {
      const refs = Array.from(usersStatsToDelete).map((userId) =>
        firestore().doc(`users/${userId}/stats/stats`)
      );

      // batch.update() fails the whole commit when the target document does
      // not exist, so verify each stats document first and only update the
      // ones that actually exist.
      const snaps = await firestore().getAll(...refs);

      snaps.forEach((snap) => {
        if (!snap.exists) return;

        functions.logger.info(`Deleting stats from ${snap.id}`);

        batch.update(snap.ref.withConverter(tweetConverter), {
          tweets: firestore.FieldValue.arrayRemove(tweetId),
          likes: firestore.FieldValue.arrayRemove(tweetId)
        });
      });
    }

    const bookmarksQuery = firestore()
      .collectionGroup('bookmarks')
      .where('id', '==', tweetId)
      .withConverter(bookmarkConverter);

    const docsSnap = await bookmarksQuery.get();

    functions.logger.info(`Deleting ${docsSnap.size} bookmarks`);

    docsSnap.docs.forEach(({ id, ref }) => {
      functions.logger.info(`Deleting bookmark ${id}`);
      batch.delete(ref);
    });

    // لا شيء للكتابة إذا لم يكن للمنشور تفاعلات أو إشارات مرجعية.
    if (docsSnap.empty && usersStatsToDelete.size === 0) {
      functions.logger.info(`Nothing to normalize for tweet ${tweetId}`);
      return;
    }

    await batch.commit();

    functions.logger.info(`Normalizing stats for tweet ${tweetId} is done`);
  });
