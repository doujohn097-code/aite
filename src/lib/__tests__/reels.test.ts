import { Timestamp } from 'firebase/firestore';
import { isReelLike, isReelVisible, mergeReels } from '../reels';
import type { Story } from '../types/story';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 30, 12);

function media(type: string, src = 'https://cdn.test/a.mp4') {
  return { id: 'm1', src, alt: '', type };
}

function story(partial: Partial<Story> & { id: string }): Story {
  return {
    userId: 'u1',
    images: null,
    caption: null,
    color: '#000000',
    likes: [],
    views: [],
    createdAt: Timestamp.fromMillis(NOW - HOUR),
    expiresAt: Timestamp.fromMillis(NOW + 24 * HOUR),
    updatedAt: null,
    ...partial
  } as Story;
}

describe('isReelLike', () => {
  it('accepts documents tagged as reels', () => {
    expect(isReelLike(story({ id: 'a', kind: 'reel' }))).toBe(true);
  });

  it('accepts untagged legacy documents that carry a video', () => {
    expect(
      isReelLike(story({ id: 'b', kind: null, images: [media('video/mp4')] }))
    ).toBe(true);
    expect(
      isReelLike(
        story({
          id: 'c',
          kind: undefined,
          images: [
            media(undefined as unknown as string, 'https://cdn.test/x.mov')
          ]
        })
      )
    ).toBe(true);
  });

  it('rejects plain stories even when they carry a video', () => {
    expect(
      isReelLike(
        story({ id: 'd', kind: 'story', images: [media('video/mp4')] })
      )
    ).toBe(false);
    expect(isReelLike(story({ id: 'e', kind: 'story' }))).toBe(false);
  });
});

describe('isReelVisible', () => {
  it('keeps reels that are older than the retired 30-day window', () => {
    const ancient = story({
      id: 'a',
      kind: 'reel',
      createdAt: Timestamp.fromMillis(NOW - 40 * 24 * HOUR),
      expiresAt: Timestamp.fromMillis(NOW - 10 * 24 * HOUR)
    });

    expect(isReelVisible(ancient)).toBe(true);
  });

  it('never hides a reel because of its expiry', () => {
    expect(
      isReelVisible(
        story({ id: 'b', kind: 'reel', expiresAt: Timestamp.fromMillis(1) })
      )
    ).toBe(true);
  });

  it('still hides plain stories', () => {
    expect(isReelVisible(story({ id: 'c', kind: 'story' }))).toBe(false);
  });
});

describe('mergeReels', () => {
  it('merges both sources without duplicating shared documents', () => {
    const shared = story({ id: 'a', kind: 'reel' });
    const tagged = [shared, story({ id: 'b', kind: 'reel' })];
    const legacy = [story({ id: 'a', kind: 'reel' }), story({ id: 'c' })];

    expect(mergeReels(tagged, legacy).map((item) => item.id)).toEqual([
      'a',
      'b',
      'c'
    ]);
  });

  it('tolerates null and empty sources', () => {
    expect(mergeReels(null, null, [])).toEqual([]);
  });
});
