import { orderBy, where } from 'firebase/firestore';
import { getTimestampMillis } from './date';
import type { QueryConstraint } from 'firebase/firestore';
import type { Story } from './types/story';

/**
 * قيود استعلام الريلز الموسومة: تعتمد على الفهرس المركّب
 * stories(kind ASC, createdAt DESC) الموجود في firestore.indexes.json.
 */
export function reelQueryConstraints(): QueryConstraint[] {
  return [where('kind', '==', 'reel'), orderBy('createdAt', 'desc')];
}

/**
 * هل هذا المستند ريل؟
 * الريلز الجديدة موسومة بـ kind:'reel'، لكن الريلز القديمة المنشورة قبل إضافة
 * الوسم لا تحمل الحقل إطلاقاً — لذلك نعتمد أيضاً على نوع الوسائط حتى لا تختفي
 * ريلزات المستخدم من التغذية.
 */
export function isReelLike(story: Pick<Story, 'kind' | 'images'>): boolean {
  if (story.kind === 'reel') return true;
  if (story.kind === 'story') return false;

  const images = story.images ?? [];
  return images.some((image) => {
    if (image.type?.startsWith('video/')) return true;
    const src = image.src ?? '';
    return (
      src.includes('.mp4') || src.includes('.mov') || src.includes('.webm')
    );
  });
}

/** الريل منتهي الصلاحية (تجاوز 30 يوماً) لا يُعرض في التغذية. */
export function isReelExpired(
  story: Pick<Story, 'expiresAt'>,
  now = Date.now()
): boolean {
  const expiresMs = getTimestampMillis(story.expiresAt);
  if (!expiresMs) return false;
  return expiresMs <= now;
}

export function isReelVisible(
  story: Pick<Story, 'kind' | 'images' | 'expiresAt'>,
  now = Date.now()
): boolean {
  return isReelLike(story) && !isReelExpired(story, now);
}

/** دمج مصدري الريلز (الموسوم + القديم) بدون تكرار. */
export function mergeReels(...sources: (readonly Story[] | null)[]): Story[] {
  const byId = new Map<string, Story>();

  for (const source of sources)
    for (const story of source ?? [])
      if (story?.id && !byId.has(story.id)) byId.set(story.id, story);

  return Array.from(byId.values());
}
