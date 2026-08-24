import { adminFirestore, isAdminConfigured } from '@lib/firebase-admin';
import { hasAdminAccess } from '@lib/server/admin-auth';
import {
  cascadeDeleteReel,
  cascadeDeleteStory,
  cascadeDeleteTweet
} from '@lib/server/cascade-delete';
import type { NextApiRequest, NextApiResponse } from 'next';

type Kind = 'posts' | 'comments' | 'reels' | 'stories';

type DocItem = Record<string, unknown> & { id: string };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function toDocItem(id: string, data: unknown): DocItem {
  return { id, ...asRecord(data) };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    if (!isAdminConfigured() || !adminFirestore) {
      res.status(503).json({ error: 'خدمة الإدارة غير مهيأة' });
      return;
    }
    if (!(await hasAdminAccess(req))) {
      res.status(403).json({ error: 'صلاحية الإدارة مطلوبة' });
      return;
    }

    if (req.method === 'GET') {
      const kind = String(req.query.kind ?? 'posts') as Kind;
      const q = String(req.query.q ?? '')
        .trim()
        .toLowerCase();
      const limit = 80;

      if (kind === 'reels' || kind === 'stories') {
        const snap = await adminFirestore
          .collection('stories')
          .orderBy('createdAt', 'desc')
          .limit(120)
          .get();
        const items = snap.docs
          .map((doc) => toDocItem(doc.id, doc.data()))
          .filter((item) =>
            kind === 'reels' ? item.kind === 'reel' : item.kind !== 'reel'
          )
          .filter((item) => {
            if (!q) return true;
            const caption = String(item.caption ?? '').toLowerCase();
            const userId = String(item.userId ?? '').toLowerCase();
            return (
              caption.includes(q) || userId.includes(q) || item.id.includes(q)
            );
          })
          .slice(0, limit);
        res.status(200).json({ items });
        return;
      }

      const snap = await adminFirestore
        .collection('tweets')
        .orderBy('createdAt', 'desc')
        .limit(160)
        .get();
      const items = snap.docs
        .map((doc) => toDocItem(doc.id, doc.data()))
        .filter((item) => {
          const isComment = Boolean(asRecord(item.parent).id);
          return kind === 'comments' ? isComment : !isComment;
        })
        .filter((item) => {
          if (!q) return true;
          const text = String(item.text ?? '').toLowerCase();
          const createdBy = String(item.createdBy ?? '').toLowerCase();
          return (
            text.includes(q) || createdBy.includes(q) || item.id.includes(q)
          );
        })
        .slice(0, limit);
      res.status(200).json({ items });
      return;
    }

    if (req.method === 'DELETE') {
      const { kind, id } = req.body as { kind?: Kind; id?: string };
      if (!kind || !id || !/^[a-zA-Z0-9_-]{6,160}$/.test(id)) {
        res.status(400).json({ error: 'بيانات غير صالحة' });
        return;
      }

      let deleted = 0;
      if (kind === 'reels') deleted = await cascadeDeleteReel(id);
      else if (kind === 'stories') deleted = await cascadeDeleteStory(id);
      else deleted = await cascadeDeleteTweet(id);

      res.status(200).json({ success: true, deleted });
      return;
    }

    res.setHeader('Allow', 'GET, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin content error:', error);
    res.status(500).json({ error: 'تعذر تنفيذ العملية' });
  }
}
