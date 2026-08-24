import {
  RECENCY_BUCKET_MS,
  diversifyAuthors,
  engagementScore,
  hash01,
  rankItems,
  recencyBucket,
  recencyWeight,
  scoreItem,
  sessionSeed,
  type RankContext,
  type RankableItem
} from '../feed-rank';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Math.floor(1_700_000_000_000 / DAY_MS) * DAY_MS + 60_000;

function item(
  partial: Partial<RankableItem> & Pick<RankableItem, 'id'>
): RankableItem {
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
  seed: 'me:1',
  kind: 'post'
};

describe('feed-rank helpers', () => {
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

  it('puts later timestamps in a newer bucket', () => {
    expect(recencyBucket(now)).toBeGreaterThan(
      recencyBucket(now - RECENCY_BUCKET_MS - 1)
    );
  });
});

describe('scoreItem', () => {
  it('boosts followed authors over strangers with equal stats', () => {
    const followed = scoreItem(item({ id: 'f', authorId: 'friend' }), baseCtx);
    const stranger = scoreItem(item({ id: 's', authorId: 'stranger' }), baseCtx);
    expect(followed).toBeGreaterThan(stranger);
  });
});

describe('rankItems', () => {
  it('always keeps a newer post above an older one', () => {
    const posts = [
      item({
        id: 'old-viral',
        likes: 400,
        replies: 80,
        createdAtMs: now - 8 * 60 * 60 * 1000
      }),
      item({
        id: 'brand-new',
        authorId: 'stranger',
        createdAtMs: now - 2 * 60 * 1000,
        likes: 0
      })
    ];
    const ranked = rankItems(posts, (p) => p, baseCtx);
    expect(ranked[0].id).toBe('brand-new');
    expect(ranked[1].id).toBe('old-viral');
  });

  it('prefers followed authors inside the same recency bucket', () => {
    const posts = [
      item({
        id: 'friend',
        authorId: 'friend',
        createdAtMs: now - 10 * 60 * 1000,
        likes: 1
      }),
      item({
        id: 'stranger',
        authorId: 'other',
        createdAtMs: now - 12 * 60 * 1000,
        likes: 1
      })
    ];
    const ranked = rankItems(posts, (p) => p, baseCtx);
    expect(ranked[0].id).toBe('friend');
  });

  it('is deterministic for the same seed', () => {
    const posts = [
      item({ id: 'a', createdAtMs: now - 1000 }),
      item({ id: 'b', authorId: 'friend', createdAtMs: now - 2000 })
    ];
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
