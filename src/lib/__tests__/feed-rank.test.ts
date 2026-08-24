import {
  diversifyAuthors,
  engagementScore,
  hash01,
  isFeedMode,
  rankItems,
  recencyWeight,
  scoreItem,
  sessionSeed,
  stabilizeFeed,
  type RankContext,
  type RankableItem
} from '../feed-rank';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Math.floor(1_700_000_000_000 / DAY_MS) * DAY_MS + 60_000;

function item(partial: Partial<RankableItem> & Pick<RankableItem, 'id'>): RankableItem {
  return {
    authorId: 'u1',
    createdAtMs: now - 60 * 60 * 1000,
    likes: 0,
    replies: 0,
    reposts: 0,
    views: 0,
    hasMedia: false,
    ...partial
  };
}

const baseCtx: RankContext = {
  viewerId: 'me',
  following: ['friend'],
  nowMs: now,
  mode: 'pulse',
  seed: 'me:1',
  kind: 'post'
};

describe('feed-rank helpers', () => {
  it('accepts only known feed modes', () => {
    expect(isFeedMode('pulse')).toBe(true);
    expect(isFeedMode('hot')).toBe(true);
    expect(isFeedMode('random')).toBe(false);
    expect(isFeedMode(null)).toBe(false);
  });

  it('builds a day-stable session seed', () => {
    const start = Math.floor(now / DAY_MS) * DAY_MS;
    expect(sessionSeed('me', start)).toBe(sessionSeed('me', start + DAY_MS - 1));
    expect(sessionSeed('me', start)).not.toBe(sessionSeed('me', start + DAY_MS));
    expect(sessionSeed(null, now)).toMatch(/^anon:/);
  });

  it('hashes deterministically into 0..1', () => {
    expect(hash01('abc')).toBe(hash01('abc'));
    expect(hash01('abc')).not.toBe(hash01('abd'));
    expect(hash01('x')).toBeGreaterThanOrEqual(0);
    expect(hash01('x')).toBeLessThanOrEqual(1);
  });

  it('decays recency with half-life', () => {
    const hour = 60 * 60 * 1000;
    expect(recencyWeight(0, 10)).toBe(1);
    expect(recencyWeight(10 * hour, 10)).toBeCloseTo(0.5, 5);
    expect(recencyWeight(20 * hour, 10)).toBeCloseTo(0.25, 5);
  });

  it('weights replies and reposts above raw likes', () => {
    expect(engagementScore(item({ id: 'a', likes: 10 }))).toBeLessThan(
      engagementScore(item({ id: 'b', reposts: 10 }))
    );
    expect(engagementScore(item({ id: 'c', replies: 5 }))).toBeGreaterThan(
      engagementScore(item({ id: 'd', likes: 5 }))
    );
  });
});

describe('scoreItem', () => {
  it('boosts followed authors over strangers with equal stats', () => {
    const followed = scoreItem(item({ id: 'f', authorId: 'friend' }), baseCtx);
    const stranger = scoreItem(item({ id: 's', authorId: 'stranger' }), baseCtx);
    expect(followed).toBeGreaterThan(stranger);
  });

  it('ranks a viral older post above a dead new one in hot mode', () => {
    const viral = scoreItem(
      item({
        id: 'viral',
        likes: 80,
        replies: 20,
        reposts: 15,
        createdAtMs: now - 10 * 60 * 60 * 1000
      }),
      { ...baseCtx, mode: 'hot' }
    );
    const dead = scoreItem(
      item({ id: 'dead', createdAtMs: now - 5 * 60 * 1000 }),
      { ...baseCtx, mode: 'hot' }
    );
    expect(viral).toBeGreaterThan(dead);
  });

  it('uses createdAt as the latest score', () => {
    const newer = item({ id: 'n', createdAtMs: now });
    expect(scoreItem(newer, { ...baseCtx, mode: 'latest' })).toBe(now);
  });
});

describe('rankItems', () => {
  const posts = [
    item({ id: 'old-hot', likes: 40, replies: 8, createdAtMs: now - 8 * 60 * 60 * 1000 }),
    item({
      id: 'friend-new',
      authorId: 'friend',
      createdAtMs: now - 20 * 60 * 1000,
      likes: 2
    }),
    item({
      id: 'stranger',
      authorId: 'other',
      createdAtMs: now - 30 * 60 * 1000,
      likes: 1
    }),
    item({ id: 'mine', authorId: 'me', createdAtMs: now - 2 * 60 * 60 * 1000 })
  ];

  it('keeps chronological order in latest mode', () => {
    const ranked = rankItems(posts, (p) => p, { ...baseCtx, mode: 'latest' });
    expect(ranked.map((p) => p.id)).toEqual([
      'friend-new',
      'stranger',
      'mine',
      'old-hot'
    ]);
  });

  it('only keeps followed authors and self in following mode', () => {
    const ranked = rankItems(posts, (p) => p, {
      ...baseCtx,
      mode: 'following'
    });
    expect(ranked.map((p) => p.id).sort()).toEqual(['friend-new', 'mine']);
  });

  it('is deterministic for the same seed', () => {
    const a = rankItems(posts, (p) => p, baseCtx).map((p) => p.id);
    const b = rankItems(posts, (p) => p, baseCtx).map((p) => p.id);
    expect(a).toEqual(b);
  });
});

describe('diversifyAuthors', () => {
  it('breaks a long run from the same author', () => {
    const run = [
      { id: 'a1', authorId: 'a' },
      { id: 'a2', authorId: 'a' },
      { id: 'a3', authorId: 'a' },
      { id: 'b1', authorId: 'b' }
    ];
    expect(diversifyAuthors(run, 2).map((i) => i.id)).toEqual([
      'a1',
      'a2',
      'b1',
      'a3'
    ]);
  });
});

describe('stabilizeFeed', () => {
  it('keeps already shown items in place and appends newcomers', () => {
    const prev = [{ id: 'a' }, { id: 'b' }];
    const next = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
    expect(stabilizeFeed(prev, next, (i) => i.id).map((i) => i.id)).toEqual([
      'a',
      'b',
      'c'
    ]);
  });

  it('drops items that disappeared', () => {
    const prev = [{ id: 'a' }, { id: 'gone' }];
    const next = [{ id: 'a' }, { id: 'b' }];
    expect(stabilizeFeed(prev, next, (i) => i.id).map((i) => i.id)).toEqual([
      'a',
      'b'
    ]);
  });
});
