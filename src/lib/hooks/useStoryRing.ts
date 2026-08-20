import { useAuth } from '@lib/context/auth-context';
import { useStoryRingMap } from '@lib/story-ring-store';
import { getTimestampMillis } from '@lib/date';
import type { User } from '@lib/types/user';

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function useStoryRing(user?: Partial<User> | null): {
  hasStory: boolean;
  color: string | null;
  loading: boolean;
} {
  const { user: currentUser } = useAuth();
  const rings = useStoryRingMap();

  // Realtime shared map wins; embedded user fields are the fallback so the
  // ring still works for freshly passed user objects.
  const fromStore = user?.id ? rings[user.id] : undefined;
  const lastStoryAt = fromStore?.lastStoryAt ?? user?.lastStoryAt;
  const storyColor = fromStore?.storyColor ?? user?.storyColor ?? '#3b82f6';

  if (!lastStoryAt) return { hasStory: false, color: null, loading: false };

  const storyTime = getTimestampMillis(lastStoryAt);
  if (!storyTime) return { hasStory: false, color: null, loading: false };

  const isExpired = Date.now() - storyTime > STORY_LIFETIME_MS;
  if (isExpired) return { hasStory: false, color: null, loading: false };

  const lastViewedAt = currentUser?.storyViews?.[user?.id ?? ''];
  const lastViewedTime = getTimestampMillis(lastViewedAt);
  const isUnseen = !lastViewedTime || lastViewedTime < storyTime;

  return { hasStory: isUnseen, color: storyColor, loading: false };
}
