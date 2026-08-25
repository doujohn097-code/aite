import { Timestamp } from 'firebase/firestore';
import {
  isLiveStory,
  STORY_LIFETIME_MS,
  storyExpiryMs
} from '../story-lifetime';

describe('story lifetime', () => {
  const now = Date.UTC(2026, 7, 25, 12, 0, 0);

  it('expires exactly 24 hours after creation', () => {
    const createdAt = Timestamp.fromMillis(now - STORY_LIFETIME_MS - 1);
    expect(
      isLiveStory({ kind: 'story', createdAt, expiresAt: null }, now)
    ).toBe(false);
    expect(
      isLiveStory(
        {
          kind: 'story',
          createdAt: Timestamp.fromMillis(now - STORY_LIFETIME_MS + 1000)
        },
        now
      )
    ).toBe(true);
  });

  it('never trusts an expiresAt beyond 24 hours', () => {
    const createdAt = Timestamp.fromMillis(now - 30 * 60 * 60 * 1000);
    const expiresAt = Timestamp.fromMillis(now + 10 * 24 * 60 * 60 * 1000);
    expect(storyExpiryMs({ kind: 'story', createdAt, expiresAt })).toBe(
      now - 6 * 60 * 60 * 1000
    );
    expect(isLiveStory({ kind: 'story', createdAt, expiresAt }, now)).toBe(
      false
    );
  });

  it('never treats reels as live stories', () => {
    expect(
      isLiveStory(
        {
          kind: 'reel',
          createdAt: Timestamp.fromMillis(now)
        },
        now
      )
    ).toBe(false);
  });
});
