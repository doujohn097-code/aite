import { createHash } from 'crypto';
import admin from 'firebase-admin';
import { verifyIdToken } from '@lib/firebase-admin';
import { extractMentions } from '@lib/mention-parser';
import { notificationPushCopy } from '@lib/notification-target';
import { resolveProfileName } from '@lib/utils';
import { consumeRateLimit } from '@lib/server/rate-limit';
import { assertAppCheck } from '@lib/server/app-check';
import { tx } from '@lib/i18n/tx';
import type { NextApiRequest, NextApiResponse } from 'next';

type ActivityType =
  | 'like'
  | 'retweet'
  | 'follow'
  | 'reply'
  | 'storyLike'
  | 'mention'
  | 'publish';

type NotifyInput = {
  type?: ActivityType;
  toUserId?: string;
  context?: 'post' | 'reel' | 'story';
  tweetId?: string | null;
  storyId?: string | null;
  storyUserId?: string | null;
};

type NotificationTarget = {
  userId: string;
  data: Record<string, unknown>;
  url: string;
};

function cleanId(value: unknown): string | null {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value)
    ? value
    : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function senderFields(sender: Record<string, unknown>): {
  fromName: string | null;
  fromUsername: string | null;
  fromPhotoURL: string | null;
} {
  const name = typeof sender.name === 'string' ? sender.name.trim() : '';
  const username =
    typeof sender.username === 'string' ? sender.username.trim() : '';
  const photoURL =
    typeof sender.photoURL === 'string' ? sender.photoURL.trim() : '';
  return {
    fromName: name ? name.slice(0, 80) : null,
    fromUsername: username ? username.slice(0, 15) : null,
    fromPhotoURL: photoURL ? photoURL.slice(0, 500) : null
  };
}

async function sendActivityPush(
  target: NotificationTarget,
  sender: Record<string, unknown>
): Promise<void> {
  const firestore = admin.firestore();
  const recipient = await firestore.doc(`users/${target.userId}`).get();
  const tokens = ((recipient.data()?.fcmTokens as unknown[]) ?? [])
    .filter((token): token is string => typeof token === 'string')
    .slice(0, 20);
  if (!tokens.length) return;

  const senderName = resolveProfileName(
    {
      name: typeof sender.name === 'string' ? sender.name : '',
      username: typeof sender.username === 'string' ? sender.username : ''
    },
    tx('common.user')
  ).slice(0, 80);
  const senderPhoto =
    typeof sender.photoURL === 'string' ? sender.photoURL.slice(0, 500) : null;
  const type = String(target.data.type ?? 'mention') as ActivityType;
  const context =
    target.data.context === 'reel' ||
    target.data.context === 'story' ||
    target.data.context === 'post'
      ? target.data.context
      : null;
  const copy = notificationPushCopy(type, context, senderName);

  await admin
    .messaging()
    .sendEachForMulticast({
      tokens,
      data: {
        title: copy.title,
        body: copy.body,
        url: target.url,
        channel: type === 'mention' ? 'mentions' : 'activity',
        tag: `${type}-${String(
          target.data.tweetId ?? target.data.storyId ?? target.userId
        )}`,
        ...(senderPhoto ? { image: senderPhoto } : {})
      },
      apns: { headers: { 'apns-priority': '10' } },
      webpush: {
        headers: { Urgency: 'high' },
        fcmOptions: { link: target.url }
      }
    })
    .catch(() => undefined);
}

async function mentionTargets(
  senderId: string,
  input: NotifyInput
): Promise<{ targets: NotificationTarget[]; sender: Record<string, unknown> }> {
  const firestore = admin.firestore();
  const context = input.context;
  let text = '';
  let sourceId = '';
  let baseData: Record<string, unknown> = {};
  let url = '/notifications';

  if (context === 'post') {
    const tweetId = cleanId(input.tweetId);
    if (!tweetId) throw new Error('invalid_target');
    const snapshot = await firestore.doc(`tweets/${tweetId}`).get();
    const data = asRecord(snapshot.data());
    if (!snapshot.exists || data.createdBy !== senderId)
      throw new Error('forbidden');
    text = typeof data.text === 'string' ? data.text : '';
    sourceId = tweetId;
    const parentId = cleanId(asRecord(data.parent).id);
    if (parentId) {
      const parentStory = await firestore.doc(`stories/${parentId}`).get();
      if (parentStory.exists && asRecord(parentStory.data()).kind === 'reel') {
        baseData = { tweetId, storyId: parentId, context: 'reel' };
        url = `/reels?video=${parentId}`;
      } else {
        baseData = { tweetId: parentId, context: 'post' };
        url = `/tweet/${parentId}`;
      }
    } else {
      baseData = { tweetId, context: 'post' };
      url = `/tweet/${tweetId}`;
    }
  } else if (context === 'reel' || context === 'story') {
    const storyId = cleanId(input.storyId);
    if (!storyId) throw new Error('invalid_target');
    const snapshot = await firestore.doc(`stories/${storyId}`).get();
    const data = asRecord(snapshot.data());
    if (!snapshot.exists || data.userId !== senderId)
      throw new Error('forbidden');
    if (context === 'reel' && data.kind !== 'reel')
      throw new Error('invalid_target');
    if (context === 'story' && data.kind === 'reel')
      throw new Error('invalid_target');
    text = typeof data.caption === 'string' ? data.caption : '';
    sourceId = storyId;
    baseData = {
      storyId,
      context,
      ...(context === 'story' ? { storyUserId: senderId } : {})
    };
    url =
      context === 'reel'
        ? `/reels?video=${storyId}`
        : `/stories/${senderId}?storyId=${storyId}`;
  } else throw new Error('invalid_target');

  const usernames = extractMentions(text);
  const senderSnapshot = await firestore.doc(`users/${senderId}`).get();
  const sender = asRecord(senderSnapshot.data());
  if (!usernames.length) return { targets: [], sender };

  const usersSnapshot = await firestore
    .collection('users')
    .where('username', 'in', usernames)
    .get();
  const senderBlocked = new Set(asStringArray(sender.blockedUsers));

  const targets: NotificationTarget[] = usersSnapshot.docs
    .filter((document) => {
      if (document.id === senderId || senderBlocked.has(document.id))
        return false;
      const blocked = asStringArray(asRecord(document.data()).blockedUsers);
      return !blocked.includes(senderId);
    })
    .map((document) => ({
      userId: document.id,
      data: {
        type: 'mention',
        fromUserId: senderId,
        toUserId: document.id,
        ...baseData,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      url
    }));

  // Include the source id in the caller-visible shape for deterministic dedupe.
  targets.forEach((target) => {
    target.data.sourceId = sourceId;
  });
  return { targets, sender };
}

const MAX_FOLLOWER_NOTIFY = 200;

async function publishTargets(
  senderId: string,
  input: NotifyInput
): Promise<{ targets: NotificationTarget[]; sender: Record<string, unknown> }> {
  const firestore = admin.firestore();
  const context = input.context;
  let sourceId = '';
  let baseData: Record<string, unknown> = {};
  let url = '/notifications';

  if (context === 'post') {
    const tweetId = cleanId(input.tweetId);
    if (!tweetId) throw new Error('invalid_target');
    const snapshot = await firestore.doc(`tweets/${tweetId}`).get();
    const data = asRecord(snapshot.data());
    if (!snapshot.exists || data.createdBy !== senderId)
      throw new Error('forbidden');
    if (asRecord(data.parent).id) throw new Error('invalid_target');
    sourceId = tweetId;
    baseData = { type: 'publish', tweetId, context: 'post' };
    url = `/tweet/${tweetId}`;
  } else if (context === 'reel') {
    const storyId = cleanId(input.storyId);
    if (!storyId) throw new Error('invalid_target');
    const snapshot = await firestore.doc(`stories/${storyId}`).get();
    const data = asRecord(snapshot.data());
    if (!snapshot.exists || data.userId !== senderId || data.kind !== 'reel')
      throw new Error('forbidden');
    sourceId = storyId;
    baseData = { type: 'publish', storyId, context: 'reel' };
    url = `/reels?video=${storyId}`;
  } else throw new Error('invalid_target');

  const senderSnapshot = await firestore.doc(`users/${senderId}`).get();
  const sender = asRecord(senderSnapshot.data());
  const senderBlocked = new Set(asStringArray(sender.blockedUsers));
  const followerIds = Array.from(
    new Set(asStringArray(sender.followers))
  ).filter((id) => id && id !== senderId && !senderBlocked.has(id));

  const allowed: string[] = [];
  for (let index = 0; index < followerIds.length; index += 100) {
    if (allowed.length >= MAX_FOLLOWER_NOTIFY) break;
    const chunk = followerIds.slice(index, index + 100);
    const refs = chunk.map((id) => firestore.doc(`users/${id}`));
    if (!refs.length) continue;
    const snapshots = await firestore.getAll(...refs);
    snapshots.forEach((document) => {
      if (allowed.length >= MAX_FOLLOWER_NOTIFY || !document.exists) return;
      const blocked = asStringArray(asRecord(document.data()).blockedUsers);
      if (blocked.includes(senderId)) return;
      allowed.push(document.id);
    });
  }

  const targets: NotificationTarget[] = allowed.map((userId) => ({
    userId,
    data: {
      ...baseData,
      fromUserId: senderId,
      toUserId: userId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      sourceId
    },
    url
  }));

  return { targets, sender };
}

async function validateActivity(
  senderId: string,
  input: NotifyInput
): Promise<NotificationTarget> {
  const firestore = admin.firestore();
  const type = input.type;
  const recipientId = cleanId(input.toUserId);
  if (!type || type === 'mention' || !recipientId || recipientId === senderId)
    throw new Error('invalid_target');

  const recipientSnapshot = await firestore.doc(`users/${recipientId}`).get();
  const recipient = asRecord(recipientSnapshot.data());
  if (!recipientSnapshot.exists) throw new Error('not_found');
  const recipientBlocked = asStringArray(recipient.blockedUsers);
  if (recipientBlocked.includes(senderId)) throw new Error('blocked');

  if (type === 'follow') {
    const followers = asStringArray(recipient.followers);
    if (!followers.includes(senderId)) throw new Error('forbidden');
    return {
      userId: recipientId,
      data: {
        type,
        fromUserId: senderId,
        toUserId: recipientId,
        context: 'post'
      },
      url: '/notifications'
    };
  }

  if (type === 'storyLike') {
    const storyId = cleanId(input.storyId);
    if (!storyId) throw new Error('invalid_target');
    const story = await firestore.doc(`stories/${storyId}`).get();
    const data = asRecord(story.data());
    const likes = asStringArray(data.likes);
    if (
      !story.exists ||
      data.userId !== recipientId ||
      !likes.includes(senderId)
    )
      throw new Error('forbidden');
    const isReel = input.context === 'reel' || data.kind === 'reel';
    return {
      userId: recipientId,
      data: {
        type,
        fromUserId: senderId,
        toUserId: recipientId,
        storyId,
        context: isReel ? 'reel' : 'story',
        ...(isReel ? {} : { storyUserId: recipientId })
      },
      url: isReel
        ? `/reels?video=${storyId}`
        : `/stories/${recipientId}?storyId=${storyId}`
    };
  }

  const tweetId = cleanId(input.tweetId);
  if (!tweetId) throw new Error('invalid_target');
  const tweet = await firestore.doc(`tweets/${tweetId}`).get();
  const data = asRecord(tweet.data());
  if (!tweet.exists) throw new Error('not_found');

  if (type === 'like' || type === 'retweet') {
    const list = asStringArray(
      type === 'like' ? data.userLikes : data.userRetweets
    );
    if (data.createdBy !== recipientId || !list.includes(senderId))
      throw new Error('forbidden');
    return {
      userId: recipientId,
      data: {
        type,
        fromUserId: senderId,
        toUserId: recipientId,
        tweetId,
        context: 'post'
      },
      url: `/tweet/${tweetId}`
    };
  }

  if (type === 'reply') {
    if (data.createdBy !== senderId) throw new Error('forbidden');
    const parentId = cleanId(asRecord(data.parent).id);
    if (!parentId) throw new Error('invalid_target');

    if (input.context === 'reel') {
      const reel = await firestore.doc(`stories/${parentId}`).get();
      if (!reel.exists || asRecord(reel.data()).userId !== recipientId)
        throw new Error('forbidden');
      return {
        userId: recipientId,
        data: {
          type,
          fromUserId: senderId,
          toUserId: recipientId,
          storyId: parentId,
          tweetId,
          context: 'reel'
        },
        url: `/reels?video=${parentId}`
      };
    }

    const parent = await firestore.doc(`tweets/${parentId}`).get();
    if (!parent.exists || asRecord(parent.data()).createdBy !== recipientId)
      throw new Error('forbidden');
    return {
      userId: recipientId,
      data: {
        type,
        fromUserId: senderId,
        toUserId: recipientId,
        tweetId: parentId,
        context: 'post'
      },
      url: `/tweet/${parentId}`
    };
  }

  throw new Error('invalid_type');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    try {
      await assertAppCheck(req);
    } catch {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const { uid: senderId } = await verifyIdToken(token);
    const rate = consumeRateLimit(`notification:${senderId}`, 20, 60_000);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    const input = (req.body ?? {}) as NotifyInput;
    const firestore = admin.firestore();

    if (input.type === 'mention') {
      const { targets, sender } = await mentionTargets(senderId, input);
      let created = 0;
      for (const target of targets) {
        const sourceId = String(target.data.sourceId ?? 'content');
        delete target.data.sourceId;
        const id = createHash('sha256')
          .update(
            `mention:${senderId}:${target.userId}:${
              input.context ?? 'unknown'
            }:${sourceId}`
          )
          .digest('hex')
          .slice(0, 40);
        const ref = firestore.doc(`users/${target.userId}/notifications/${id}`);
        try {
          await ref.create({ ...target.data, ...senderFields(sender) });
          created += 1;
          await sendActivityPush(target, sender);
        } catch (error) {
          const code = (error as { code?: number | string })?.code;
          if (code !== 6 && code !== '6' && code !== 'already-exists')
            throw error;
        }
      }
      res.status(200).json({ ok: true, created });
      return;
    }

    const target = await validateActivity(senderId, input);
    const sender = asRecord(
      (await firestore.doc(`users/${senderId}`).get()).data()
    );
    await firestore.collection(`users/${target.userId}/notifications`).add({
      ...target.data,
      ...senderFields(sender),
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await sendActivityPush(target, sender);
    res.status(200).json({ ok: true, created: 1, url: target.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal';
    const status =
      message === 'forbidden' || message === 'blocked'
        ? 403
        : message === 'not_found'
        ? 404
        : message.startsWith('invalid')
        ? 400
        : 500;
    if (status === 500) console.error('notifications/create failed:', error);
    res.status(status).json({ error: message });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '16kb' } },
  maxDuration: 60
};
