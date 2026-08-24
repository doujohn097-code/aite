export type RankableItem = {
  id: string;
  authorId: string;
  createdAtMs: number;
  likes: number;
  replies: number;
  reposts: number;
  views?: number;
  hasMedia?: boolean;
};

export type RankContext = {
  viewerId: string | null;
  following: readonly string[];
  nowMs: number;
  seed: string;
  kind?: 'post' | 'reel';
};

const HOUR = 60 * 60 * 1000;
/** Newer buckets always sit above older ones. Pulse only reorders inside a bucket. */
export const RECENCY_BUCKET_MS = 2 * HOUR;

export function sessionSeed(viewerId: string | null, nowMs: number): string {
  const day = Math.floor(nowMs / (24 * HOUR));
  return `${viewerId ?? 'anon'}:${day}`;
}

export function recencyBucket(createdAtMs: number): number {
  return Math.floor(Math.max(0, createdAtMs) / RECENCY_BUCKET_MS);
}

/** Deterministic 0..1 from a string. Stable across clients. */
export function hash01(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function recencyWeight(ageMs: number, halfLifeHours: number): number {
  if (ageMs <= 0) return 1;
  const halfLifeMs = Math.max(halfLifeHours, 0.25) * HOUR;
  return Math.pow(0.5, ageMs / halfLifeMs);
}

export function engagementScore(item: RankableItem): number {
  const raw =
    Math.max(0, item.likes) +
    Math.max(0, item.replies) * 1.8 +
    Math.max(0, item.reposts) * 2.4 +
    Math.max(0, item.views ?? 0) * 0.12;
  return Math.log1p(raw);
}

export function scoreItem(item: RankableItem, ctx: RankContext): number {
  const following = new Set(ctx.following);
  const ageMs = Math.max(0, ctx.nowMs - item.createdAtMs);
  const isFollowed = following.has(item.authorId);
  const isSelf = !!ctx.viewerId && item.authorId === ctx.viewerId;
  const halfLife = ctx.kind === 'reel' ? 10 : 18;
  const recency = recencyWeight(ageMs, halfLife);
  const engagement = engagementScore(item);
  const jitter = hash01(`${ctx.seed}:${item.id}`) * 0.28;
  const followBoost = isFollowed ? 1.45 : 1;
  const selfBoost = isSelf ? 1.18 : 1;
  const mediaBoost = item.hasMedia ? 1.08 : 1;
  const discovery = isFollowed || isSelf ? 0 : 0.16 * (0.4 + jitter);

  return (
    (recency * 3.1 + engagement * 1.7 + discovery) *
      followBoost *
      selfBoost *
      mediaBoost +
    jitter
  );
}

export function diversifyAuthors<T extends { authorId: string }>(
  items: readonly T[],
  maxRun = 2
): T[] {
  const rest = [...items];
  const out: T[] = [];

  while (rest.length) {
    let index = 0;
    if (out.length >= maxRun) {
      const recent = out.slice(-maxRun);
      const author = recent[0]?.authorId;
      const streak = author && recent.every((item) => item.authorId === author);
      if (streak) {
        const found = rest.findIndex((item) => item.authorId !== author);
        if (found >= 0) index = found;
      }
    }
    out.push(rest.splice(index, 1)[0]);
  }

  return out;
}

export function rankItems<T>(
  items: readonly T[],
  mapItem: (item: T) => RankableItem,
  ctx: RankContext
): T[] {
  const mapped = items.map((item) => ({
    item,
    rank: mapItem(item),
    score: 0
  }));

  mapped.forEach((entry) => {
    entry.score = scoreItem(entry.rank, ctx);
  });

  const buckets = new Map<number, typeof mapped>();
  for (const entry of mapped) {
    const key = recencyBucket(entry.rank.createdAtMs);
    const list = buckets.get(key) ?? [];
    list.push(entry);
    buckets.set(key, list);
  }

  const orderedBuckets = Array.from(buckets.keys()).sort((a, b) => b - a);
  const result: T[] = [];

  for (const key of orderedBuckets) {
    const group = (buckets.get(key) ?? []).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.rank.createdAtMs - a.rank.createdAtMs;
    });
    const mixed = diversifyAuthors(
      group.map(({ item, rank }) => ({ item, authorId: rank.authorId }))
    );
    mixed.forEach(({ item }) => result.push(item));
  }

  return result;
}
