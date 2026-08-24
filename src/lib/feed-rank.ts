export type FeedMode = 'pulse' | 'following' | 'latest' | 'hot';

export const FEED_MODES: readonly FeedMode[] = [
  'pulse',
  'following',
  'latest',
  'hot'
];

export const FEED_MODE_LABELS: Record<FeedMode, string> = {
  pulse: 'نبض',
  following: 'المتابَعون',
  latest: 'الأحدث',
  hot: 'الأقوى'
};

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
  mode: FeedMode;
  seed: string;
  kind?: 'post' | 'reel';
};

const HOUR = 60 * 60 * 1000;

export function isFeedMode(value: unknown): value is FeedMode {
  return (
    value === 'pulse' ||
    value === 'following' ||
    value === 'latest' ||
    value === 'hot'
  );
}

export function sessionSeed(viewerId: string | null, nowMs: number): string {
  const day = Math.floor(nowMs / (24 * HOUR));
  return `${viewerId ?? 'anon'}:${day}`;
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

export function recencyWeight(
  ageMs: number,
  halfLifeHours: number
): number {
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

  if (ctx.mode === 'latest') return item.createdAtMs;

  if (ctx.mode === 'hot') {
    const week = 7 * 24 * HOUR;
    const freshness = ageMs > week ? 0.35 : recencyWeight(ageMs, 36);
    return (
      engagement * 2.2 * freshness +
      (isFollowed ? 0.55 : 0) +
      (isSelf ? 0.2 : 0) +
      (item.hasMedia ? 0.12 : 0)
    );
  }

  // pulse + following share the same scorer; following is filtered first.
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
  const following = new Set(ctx.following);
  const mapped = items.map((item) => ({ item, rank: mapItem(item) }));

  const pool =
    ctx.mode === 'following'
      ? mapped.filter(
          ({ rank }) =>
            following.has(rank.authorId) || rank.authorId === ctx.viewerId
        )
      : mapped;

  if (ctx.mode === 'latest') {
    return pool
      .slice()
      .sort((a, b) => b.rank.createdAtMs - a.rank.createdAtMs)
      .map(({ item }) => item);
  }

  const scored = pool
    .map((entry) => ({
      ...entry,
      score: scoreItem(entry.rank, ctx)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.rank.createdAtMs - a.rank.createdAtMs;
    });

  if (ctx.mode === 'hot') return scored.map(({ item }) => item);

  return diversifyAuthors(
    scored.map(({ item, rank }) => ({ item, authorId: rank.authorId }))
  ).map(({ item }) => item);
}

export function stabilizeFeed<T>(
  previous: readonly T[],
  nextRanked: readonly T[],
  getId: (item: T) => string
): T[] {
  if (!previous.length) return [...nextRanked];

  const nextById = new Map(nextRanked.map((item) => [getId(item), item]));
  const kept: T[] = [];
  const seen = new Set<string>();

  for (const item of previous) {
    const id = getId(item);
    const fresh = nextById.get(id);
    if (!fresh) continue;
    kept.push(fresh);
    seen.add(id);
  }

  const newcomers = nextRanked.filter((item) => !seen.has(getId(item)));
  return [...kept, ...newcomers];
}
