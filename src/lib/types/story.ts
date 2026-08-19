import { Timestamp, type FirestoreDataConverter } from 'firebase/firestore';
import type { ImagesPreview } from './file';

export type StoryKind = 'story' | 'reel';

export type Story = {
  id: string;
  userId: string;
  images: ImagesPreview | null;
  caption: string | null;
  color: string;
  duration?: number | null;
  music?: { src: string; name: string } | null;
  likes: string[];
  views: string[];
  kind?: StoryKind | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  updatedAt: Timestamp | null;
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
    return {
      id,
      userId: '',
      images: null,
      caption: null,
      color: '#3b82f6',
      duration: null,
      music: null,
      likes: [],
      views: [],
      kind: 'story',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      updatedAt: null,
      ...data
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
