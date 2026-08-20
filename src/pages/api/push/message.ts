import admin from 'firebase-admin';
import { verifyIdToken } from '@lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';

type PushBody = {
  conversationId?: string;
  preview?: string;
};

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

    const { conversationId, preview } = req.body as PushBody;
    if (!conversationId) {
      res.status(400).json({ error: 'missing_conversation' });
      return;
    }

    const firestore = admin.firestore();
    const conversationSnap = await firestore
      .doc(`conversations/${conversationId}`)
      .get();
    if (!conversationSnap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const participants =
      (conversationSnap.data()?.participants as string[] | undefined) ?? [];
    if (!participants.includes(decoded.uid)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const recipientId = participants.find(
      (participant) => participant !== decoded.uid
    );
    if (!recipientId) {
      res.status(200).json({ ok: true, sent: 0 });
      return;
    }

    const [recipientSnap, senderSnap] = await Promise.all([
      firestore.doc(`users/${recipientId}`).get(),
      firestore.doc(`users/${decoded.uid}`).get()
    ]);

    const tokens =
      (recipientSnap.data()?.fcmTokens as string[] | undefined) ?? [];
    if (!tokens.length) {
      res.status(200).json({ ok: true, sent: 0 });
      return;
    }

    const senderData = senderSnap.data() ?? {};
    const senderName =
      (senderData.name as string | undefined) ??
      (senderData.username as string | undefined) ??
      'رسالة جديدة';

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        title: String(senderName),
        body: String(preview ?? 'أرسل لك رسالة').slice(0, 180),
        url: `/messages/${conversationId}`,
        channel: 'messages',
        tag: `conv-${conversationId}`
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
  } catch {
    res.status(500).json({ error: 'internal' });
  }
}
