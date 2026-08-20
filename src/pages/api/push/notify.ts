import admin from 'firebase-admin';
import { verifyIdToken } from '@lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

type NotifyBody = {
  kind?: 'message' | 'messageReaction' | 'activity';
  conversationId?: string;
  preview?: string;
  emoji?: string;
  toUserId?: string;
  type?: string;
  context?: 'post' | 'reel' | 'story';
  tweetId?: string | null;
  storyId?: string | null;
  storyUserId?: string | null;
};

type BuiltNotification = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

function buildActivityNotification(
  body: NotifyBody,
  senderName: string,
  senderUsername: string,
  senderId: string
): BuiltNotification {
  const { type, context, tweetId, storyId, storyUserId } = body;

  switch (type) {
    case 'follow':
      return {
        title: 'متابع جديد',
        body: `قام ${senderName} بمتابعتك`,
        url: `/user/${senderUsername}`,
        tag: `follow-${senderId}`
      };
    case 'like':
      return {
        title: 'إعجاب',
        body: `قام ${senderName} بالتفاعل مع منشورك`,
        url: tweetId ? `/tweet/${tweetId}` : '/home',
        tag: `like-${senderId}-${tweetId ?? ''}`
      };
    case 'retweet':
      return {
        title: 'إعادة نشر',
        body: `قام ${senderName} بإعادة نشر منشورك`,
        url: tweetId ? `/tweet/${tweetId}` : '/home',
        tag: `retweet-${senderId}-${tweetId ?? ''}`
      };
    case 'reply':
      return context === 'reel'
        ? {
            title: 'تعليق جديد',
            body: `قام ${senderName} بالتعليق على الريلز الخاص بك`,
            url: '/reels',
            tag: `reel-comment-${senderId}`
          }
        : {
            title: 'رد جديد',
            body: `قام ${senderName} بالرد على منشورك`,
            url: tweetId ? `/tweet/${tweetId}` : '/home',
            tag: `reply-${senderId}-${tweetId ?? ''}`
          };
    case 'storyLike':
      return context === 'reel'
        ? {
            title: 'تفاعل مع الريلز',
            body: `قام ${senderName} بالتفاعل مع الريلز الخاص بك`,
            url: '/reels',
            tag: `reel-like-${senderId}`
          }
        : {
            title: 'تفاعل مع قصتك',
            body: `قام ${senderName} بالتفاعل مع قصتك`,
            url: storyUserId
              ? `/stories/${storyUserId}?storyId=${storyId ?? ''}`
              : '/home',
            tag: `story-like-${senderId}`
          };
    default:
      return {
        title: 'Aite',
        body: `قام ${senderName} بالتفاعل معك`,
        url: '/notifications',
        tag: `activity-${senderId}`
      };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization ?? '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const decoded = await verifyIdToken(idToken);
    const senderId = decoded.uid;

    const body = req.body as NotifyBody;
    const kind = body.kind ?? 'activity';

    const firestore = admin.firestore();

    let recipientId: string | undefined;
    let notification: BuiltNotification | null = null;

    const senderSnap = await firestore.doc(`users/${senderId}`).get();
    const senderData = senderSnap.data() ?? {};
    const senderName =
      (senderData.name as string | undefined) ??
      (senderData.username as string | undefined) ??
      'مستخدم';
    const senderUsername =
      (senderData.username as string | undefined) ?? senderId;
    const senderPhoto = (senderData.photoURL as string | undefined) ?? null;

    if (kind === 'message' || kind === 'messageReaction') {
      const { conversationId } = body;
      if (!conversationId) {
        res.status(400).json({ error: 'missing_conversation' });
        return;
      }

      const conversationSnap = await firestore
        .doc(`conversations/${conversationId}`)
        .get();
      if (!conversationSnap.exists) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      const participants =
        (conversationSnap.data()?.participants as string[] | undefined) ?? [];
      if (!participants.includes(senderId)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      recipientId = participants.find(
        (participant) => participant !== senderId
      );

      notification =
        kind === 'message'
          ? {
              title: `رسالة من ${senderName}`,
              body: String(body.preview ?? 'أرسل لك رسالة').slice(0, 180),
              url: `/messages/${conversationId}`,
              tag: `conv-${conversationId}`
            }
          : {
              title: 'تفاعل مع رسالتك',
              body: `قام ${senderName} بالتفاعل مع رسالتك ${
                body.emoji ?? ''
              }`.trim(),
              url: `/messages/${conversationId}`,
              tag: `conv-${conversationId}`
            };
    } else {
      recipientId = body.toUserId;
      if (!recipientId || recipientId === senderId) {
        res.status(200).json({ ok: true, sent: 0 });
        return;
      }
      notification = buildActivityNotification(
        body,
        senderName,
        senderUsername,
        senderId
      );
    }

    if (!recipientId || !notification) {
      res.status(200).json({ ok: true, sent: 0 });
      return;
    }

    const recipientSnap = await firestore.doc(`users/${recipientId}`).get();
    const tokens =
      (recipientSnap.data()?.fcmTokens as string[] | undefined) ?? [];
    if (!tokens.length) {
      res.status(200).json({ ok: true, sent: 0, reason: 'no_tokens' });
      return;
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        title: notification.title,
        body: notification.body,
        url: notification.url,
        channel: 'messages',
        tag: notification.tag,
        ...(senderPhoto ? { image: senderPhoto } : {})
      },
      android: { priority: 'high' }
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((result, index) => {
      const code = result.error?.code ?? '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token') ||
        code.includes('invalid-argument')
      )
        invalidTokens.push(tokens[index]);
    });

    if (invalidTokens.length)
      await firestore
        .doc(`users/${recipientId}`)
        .update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
        })
        .catch(() => undefined);

    res.status(200).json({ ok: true, sent: response.successCount });
  } catch (error) {
    console.error('push/notify failed:', error);
    const message = error instanceof Error ? error.message : 'unknown';
    res.status(500).json({ error: 'internal', message });
  }
}
