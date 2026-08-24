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

type Author = {
  id: string;
  name: string;
  username: string;
  photoURL: string | null;
  verified: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  const rec = asRecord(value);
  if (typeof rec.toMillis === 'function')
    return (rec as { toMillis: () => number }).toMillis();
  if (typeof rec.toDate === 'function')
    return (rec as { toDate: () => Date }).toDate().getTime();
  if (typeof rec.seconds === 'number')
    return rec.seconds * 1000 + Math.round(((rec.nanoseconds as number) ?? 0) / 1e6);
  if (typeof rec._seconds === 'number')
    return rec._seconds * 1000 + Math.round(((rec._nanoseconds as number) ?? 0) / 1e6);
  return null;
}

function mediaList(value: unknown): { src: string; thumbnail: string | null; type: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const rec = asRecord(entry);
      const src = String(rec.src ?? rec.url ?? '');
      if (!src) return null;
      return {
        src,
        thumbnail: rec.thumbnail ? String(rec.thumbnail) : null,
        type: String(rec.type ?? '')
      };
    })
    .filter((item): item is { src: string; thumbnail: string | null; type: string } => !!item);
}

function toDocItem(id: string, data: unknown): DocItem {
  return { id, ...asRecord(data) };
}

async function loadAuthors(ids: string[]): Promise<Record<string, Author>> {
  if (!adminFirestore || !ids.length) return {};
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const authors: Record<string, Author> = {};
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const refs = chunk.map((id) => adminFirestore!.collection('users').doc(id));
    const snaps = await adminFirestore!.getAll(...refs);
    snaps.forEach((snap) => {
      const data = asRecord(snap.data());
      authors[snap.id] = {
        id: snap.id,
        name: String(data.name ?? ''),
        username: String(data.username ?? ''),
        photoURL: data.photoURL ? String(data.photoURL) : null,
        verified: Boolean(data.verified)
      };
    });
  }
  return authors;
}

function presentItem(item: DocItem, authors: Record<string, Author>) {
  const authorId = String(item.createdBy ?? item.userId ?? '');
  const parent = asRecord(item.parent);
  const likes = Array.isArray(item.userLikes)
    ? item.userLikes.length
    : Array.isArray(item.likes)
    ? item.likes.length
    : 0;
  const views = Array.isArray(item.views) ? item.views.length : 0;
  return {
    id: item.id,
    text: item.text ?? null,
    caption: item.caption ?? null,
    createdBy: authorId || null,
    userId: item.userId ?? null,
    kind: item.kind ?? null,
    parentId: parent.id ? String(parent.id) : null,
    parentUsername: parent.username ? String(parent.username) : null,
    createdAt: toMillis(item.createdAt),
    media: mediaList(item.images),
    likes,
    replies: typeof item.userReplies === 'number' ? item.userReplies : 0,
    views,
    author: authors[authorId] ?? null
  };
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
        const raw = snap.docs
          .map((doc) => toDocItem(doc.id, doc.data()))
          .filter((item) =>
            kind === 'reels' ? item.kind === 'reel' : item.kind !== 'reel'
          );
        const authors = await loadAuthors(
          raw.map((item) => String(item.userId ?? ''))
        );
        const items = raw
          .map((item) => presentItem(item, authors))
          .filter((item) => {
            if (!q) return true;
            const hay = [
              item.caption,
              item.id,
              item.createdBy,
              item.author?.name,
              item.author?.username
            ]
              .join(' ')
              .toLowerCase();
            return hay.includes(q);
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
      const raw = snap.docs
        .map((doc) => toDocItem(doc.id, doc.data()))
        .filter((item) => {
          const isComment = Boolean(asRecord(item.parent).id);
          return kind === 'comments' ? isComment : !isComment;
        });
      const authors = await loadAuthors(
        raw.map((item) => String(item.createdBy ?? ''))
      );
      const items = raw
        .map((item) => presentItem(item, authors))
        .filter((item) => {
          if (!q) return true;
          const hay = [
            item.text,
            item.id,
            item.createdBy,
            item.author?.name,
            item.author?.username
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
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
