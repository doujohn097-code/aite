import admin from 'firebase-admin';
import { verifyIdTokenAny, adminAppForProject } from '@lib/firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Query as AdminQuery } from 'firebase-admin/firestore';

/**
 * Server-side read proxy for Firestore.
 *
 * Some clients block the Firestore WebChannel (XHR long-polling) used by the
 * Firebase JS SDK — the channel to `firestore.googleapis.com` gets
 * `ERR_BLOCKED_BY_CLIENT` and live queries never resolve. This endpoint runs
 * the same reads through the admin SDK on OUR origin, so no ad blocker can
 * interfere. It only exposes whitelisted, public-ish collections with strict
 * field/op validation, and conversations are always scoped to the caller.
 */

type ProxyWhere = {
  field: string;
  op: string;
  value?: unknown;
};

type ProxySpec = {
  collection: string;
  where?: ProxyWhere | null;
  orderBy?: { field: string; dir: 'asc' | 'desc' } | null;
  limit?: number;
  /** documentId() IN — users/stories/tweets only */
  ids?: string[];
};

const ALLOWED: Record<
  string,
  { fields: string[]; orders: string[]; ids?: boolean }
> = {
  tweets: {
    fields: [
      'parent',
      'createdBy',
      'parent.id',
      'userLikes',
      'userRetweets',
      '__name__'
    ],
    orders: ['createdAt', 'updatedAt', '__name__'],
    ids: true
  },
  stories: {
    fields: ['kind', 'userId', 'expiresAt', '__name__'],
    orders: ['createdAt', 'expiresAt', '__name__'],
    ids: true
  },
  users: {
    fields: ['username', 'lastStoryAt', '__name__'],
    orders: ['username', 'lastStoryAt', '__name__'],
    ids: true
  },
  conversations: {
    // participants is forced to the caller's uid server-side; never arbitrary.
    fields: ['participants', 'updatedAt', '__name__'],
    orders: ['updatedAt', '__name__'],
    ids: false
  }
};

const OPS = new Set([
  '==',
  'in',
  'array-contains',
  'isNull',
  '>=',
  '<=',
  '>',
  '<'
]);

function isPlainValue(value: unknown): boolean {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return true;
  if (Array.isArray(value))
    return value.length <= 30 && value.every(isPlainValue);
  return false;
}

function serialize(value: unknown): unknown {
  if (value instanceof admin.firestore.Timestamp) {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof admin.firestore.DocumentReference) return value.id;
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>))
      out[key] = serialize((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

export default async function queryHandler(
  req: NextApiRequest,
  res: NextApiResponse<Record<string, unknown>>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed', v: 7 });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'unauthorized', v: 7 });
    return;
  }

  try {
    const { decoded } = await verifyIdTokenAny(token);
    const uid = decoded.uid;

    const body = req.body as { project?: unknown; q?: unknown } | null;
    const project = body?.project === 'b' ? 'b' : 'a';
    const rawQ = body?.q as ProxySpec | null | undefined;
    if (!rawQ || typeof rawQ !== 'object') {
      res.status(400).json({ error: 'invalid_query', v: 7 });
      return;
    }

    const collectionName = rawQ.collection;
    const allow = ALLOWED[collectionName];
    if (!allow) {
      res.status(400).json({ error: 'invalid_collection', v: 7 });
      return;
    }

    const limitN = Math.min(Math.max(rawQ.limit ?? 30, 1), 60);
    const app = adminAppForProject(project);
    if (!app) {
      res.status(200).json({
        items: [],
        debug: `no app for project=${project} (adminB=${!!process.env
          .FIREBASE_ADMIN_KEY_B}, adminA=${!!process.env.FIREBASE_ADMIN_KEY})`
      });
      return;
    }
    const firestore = app.firestore();
    let query: AdminQuery = firestore.collection(collectionName);

    if (rawQ.ids?.length) {
      if (!allow.ids) {
        res.status(400).json({ error: 'invalid_ids', v: 7 });
        return;
      }
      query = query.where(
        admin.firestore.FieldPath.documentId(),
        'in',
        rawQ.ids.slice(0, 30)
      );
    } else if (rawQ.where) {
      const w = rawQ.where;
      if (!allow.fields.includes(w.field) || !OPS.has(w.op)) {
        res.status(400).json({ error: 'invalid_where', v: 7 });
        return;
      }
      if (w.op !== 'isNull' && !isPlainValue(w.value)) {
        res.status(400).json({ error: 'invalid_value', v: 7 });
        return;
      }
      if (w.field === 'lastStoryAt' && typeof w.value === 'string') {
        query = query.where(w.field, w.op as '>', new Date(w.value));
      } else if (w.op === 'isNull') {
        query = query.where(w.field, '==', null);
      } else {
        query = query.where(w.field, w.op as never, w.value as never);
      }
    }

    // Conversations are ALWAYS scoped to the authenticated caller.
    if (collectionName === 'conversations') {
      query = query.where('participants', 'array-contains', uid);
    }

    if (rawQ.orderBy && allow.orders.includes(rawQ.orderBy.field)) {
      query = query.orderBy(
        rawQ.orderBy.field,
        rawQ.orderBy.dir === 'asc' ? 'asc' : 'desc'
      );
    }

    query = query.limit(limitN);

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: serialize(doc.data()) as Record<string, unknown>
    }));

    console.log('api/query ok:', {
      project,
      collection: collectionName,
      count: items.length,
      envA: !!process.env.FIREBASE_ADMIN_KEY,
      envB: !!process.env.FIREBASE_ADMIN_KEY_B
    });
    res.status(200).json({ items, v: 7, branch: 'ok' });
  } catch (error) {
    console.error('api/query failed:', error);
    res.status(200).json({
      items: [],
      v: 7,
      branch: 'error',
      debug: error instanceof Error ? error.message : String(error)
    }); // never break the UI on proxy errors
  }
}

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };
