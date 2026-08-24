import { adminFirestore } from '@lib/firebase-admin';
import type { firestore } from 'firebase-admin';

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

async function collectTweetTree(
  db: firestore.Firestore,
  rootId: string
): Promise<string[]> {
  const ids = new Set<string>([rootId]);
  let current = [rootId];

  while (current.length) {
    const next: string[] = [];
    for (const group of chunk(current, 10)) {
      const [byParent, byReplyTo] = await Promise.all([
        db.collection('tweets').where('parent.id', 'in', group).get(),
        db.collection('tweets').where('replyTo.id', 'in', group).get()
      ]);
      [...byParent.docs, ...byReplyTo.docs].forEach((doc) => {
        if (!ids.has(doc.id)) {
          ids.add(doc.id);
          next.push(doc.id);
        }
      });
    }
    current = next;
  }

  return Array.from(ids);
}

export async function cascadeDeleteTweet(tweetId: string): Promise<number> {
  if (!adminFirestore) throw new Error('admin_not_configured');
  const db = adminFirestore;
  const ids = await collectTweetTree(db, tweetId);
  const refs = ids.map((id) => db.collection('tweets').doc(id));
  return deleteRefs(db, refs);
}

export async function cascadeDeleteReel(reelId: string): Promise<number> {
  if (!adminFirestore) throw new Error('admin_not_configured');
  const db = adminFirestore;
  const comments = await db
    .collection('tweets')
    .where('parent.id', '==', reelId)
    .get();

  const tree = new Set<string>();
  for (const comment of comments.docs) {
    const descendants = await collectTweetTree(db, comment.id);
    descendants.forEach((id) => tree.add(id));
  }

  const refs = [
    ...Array.from(tree).map((id) => db.collection('tweets').doc(id)),
    db.collection('stories').doc(reelId)
  ];
  return deleteRefs(db, refs);
}

export async function cascadeDeleteStory(storyId: string): Promise<number> {
  if (!adminFirestore) throw new Error('admin_not_configured');
  await adminFirestore.collection('stories').doc(storyId).delete();
  return 1;
}
