import { Timestamp, type FirestoreDataConverter } from 'firebase/firestore';
import type { Theme, Accent } from './theme';

export type User = {
  id: string;
  bio: string | null;
  name: string;
  theme: Theme | null;
  accent: Accent | null;
  website: string | null;
  location: string | null;
  username: string;
  photoURL: string;
  verified: boolean;
  admin?: boolean;
  /** الجنس — يظهر كبادج ملوّن بجانب الاسم */
  gender?: 'male' | 'female' | null;
  /** أكمل المستخدم خطوات الإعداد الأولى */
  onboarded?: boolean;
  following: string[];
  followers: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  totalTweets: number;
  totalReplies?: number;
  totalPhotos: number;
  pinnedTweet: string | null;
  coverPhotoURL: string | null;
  storyColor?: string | null;
  lastStoryAt?: Timestamp | null;
  storyViews?: { [userId: string]: Timestamp } | null;
  /** Presence heartbeat — updated every minute while the app is open. */
  lastActiveAt?: Timestamp | null;
  /** FCM device tokens for the native app push notifications. */
  fcmTokens?: string[];
  /** Accounts this user chose not to see or contact. */
  blockedUsers?: string[];
};

export type EditableData = Extract<
  keyof User,
  'bio' | 'name' | 'website' | 'photoURL' | 'location' | 'coverPhotoURL'
>;

export type EditableUserData = Pick<User, EditableData>;

export const userConverter: FirestoreDataConverter<User> = {
  toFirestore(data) {
    const user = { ...data } as Record<string, unknown>;
    delete user.id;
    return user;
  },
  fromFirestore(snapshot, options) {
    const { id } = snapshot;
    const data = snapshot.data(options);
    return {
      id,
      bio: null,
      name: 'مستخدم',
      theme: null,
      accent: null,
      website: null,
      location: null,
      username: 'unknown',
      photoURL: '/assets/default-avatar.png',
      verified: false,
      admin: false,
      gender: null,
      onboarded: false,
      following: [],
      followers: [],
      createdAt: Timestamp.now(),
      updatedAt: null,
      totalTweets: 0,
      totalPhotos: 0,
      pinnedTweet: null,
      coverPhotoURL: null,
      storyColor: null,
      lastStoryAt: null,
      storyViews: null,
      ...data
    } as User;
  }
};
