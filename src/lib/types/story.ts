import { Timestamp, type FirestoreDataConverter } from 'firebase/firestore';
import { getTimestampMillis } from '@lib/date';
import { STORY_LIFETIME_MS } from '@lib/story-lifetime';
import type { ImagesPreview } from './file';

export type StoryKind = 'story' | 'reel';

/** نص يضعه المستخدم فوق الصورة/الفيديو */
export type StoryText = {
  id: string;
  text: string;
  /** موضع نسبي 0..1 من عرض/ارتفاع الوسائط */
  x: number;
  y: number;
  color: string;
  font: string;
  /** حجم الخط نسبةً إلى ارتفاع الوسائط (0.02 - 0.16) */
  size: number;
  align?: 'right' | 'center' | 'left';
  background?: boolean;
};

/** مقطع موسيقي مقتطع (15 ثانية) */
export type StoryMusic = {
  src: string;
  name: string;
  /** بداية المقطع بالثواني */
  start?: number;
  /** طول المقطع بالثواني */
  clip?: number;
};

export type Story = {
  id: string;
  userId: string;
  images: ImagesPreview | null;
  caption: string | null;
  captionFont?: string | null;
  color: string;
  duration?: number | null;
  music?: StoryMusic | null;
  texts?: StoryText[] | null;
  likes: string[];
  userRetweets?: string[] | null;
  views: string[];
  kind?: StoryKind | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  updatedAt: Timestamp | null;
  edited?: boolean;
  editedAt?: Timestamp | null;
};

export type StoryView = {
  id: string;
  lastViewedAt: Timestamp;
};

export const storyConverter: FirestoreDataConverter<Story> = {
  toFirestore(data) {
    const story = { ...data } as Record<string, unknown>;
    delete story.id;
    return story;
  },
  fromFirestore(snapshot, options) {
    const { id } = snapshot;
    const data = snapshot.data(options);
    const createdAt =
      (data.createdAt as Timestamp | null | undefined) ?? Timestamp.now();
    const createdMs = getTimestampMillis(createdAt);
    const derivedExpiry = Timestamp.fromMillis(
      (createdMs || Date.now()) + STORY_LIFETIME_MS
    );
    return {
      id,
      userId: '',
      images: null,
      caption: null,
      texts: null,
      color: '#3b82f6',
      duration: null,
      music: null,
      likes: [],
      views: [],
      kind: 'story',
      updatedAt: null,
      edited: false,
      editedAt: null,
      ...data,
      createdAt,
      expiresAt:
        (data.expiresAt as Timestamp | null | undefined) ?? derivedExpiry
    } as Story;
  }
};

export const storyViewConverter: FirestoreDataConverter<StoryView> = {
  toFirestore(data) {
    const view = { ...data } as Record<string, unknown>;
    delete view.id;
    return view;
  },
  fromFirestore(snapshot, options) {
    const { id } = snapshot;
    const data = snapshot.data(options);
    return {
      id,
      lastViewedAt: Timestamp.now(),
      ...data
    } as StoryView;
  }
};
