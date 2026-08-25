import { getTimestampMillis } from './date';

export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

type StoryLike = {
  kind?: string | null;
  createdAt?: unknown;
  expiresAt?: unknown;
};

/** انتهاء القصة: لا تتجاوز أبداً 24 ساعة من وقت النشر. */
export function storyExpiryMs(story: StoryLike): number {
  if (story.kind === 'reel') return 0;
  const createdMs = getTimestampMillis(story.createdAt);
  if (!createdMs) return 0;
  const cap = createdMs + STORY_LIFETIME_MS;
  const expiresMs = getTimestampMillis(story.expiresAt);
  if (!expiresMs) return cap;
  return Math.min(expiresMs, cap);
}

export function isLiveStory(story: StoryLike, now = Date.now()): boolean {
  return storyExpiryMs(story) > now;
}
