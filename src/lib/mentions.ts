import { auth } from '@lib/firebase/app';

export type MentionContext = 'post' | 'reel' | 'story';

export async function notifyMentions(
  context: MentionContext,
  sourceId: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !sourceId) return;

  try {
    const token = await user.getIdToken();
    await fetch('/api/notifications/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        type: 'mention',
        context,
        ...(context === 'post' ? { tweetId: sourceId } : { storyId: sourceId })
      })
    });
  } catch {
    // Mention delivery must never undo a successfully published item.
  }
}
