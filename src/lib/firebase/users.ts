import {
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  query,
  Timestamp,
  where
} from 'firebase/firestore';
import { usersCollection } from './collections';
import type { User } from '@lib/types/user';

export function blankUser(id = ''): User {
  return {
    id,
    bio: null,
    name: '',
    theme: null,
    accent: null,
    website: null,
    location: null,
    username: '',
    photoURL: '/assets/default-avatar.png',
    verified: false,
    following: [],
    followers: [],
    createdAt: Timestamp.now(),
    updatedAt: null,
    totalTweets: 0,
    totalPhotos: 0,
    pinnedTweet: null,
    coverPhotoURL: null
  };
}

export async function getUserByUsernameOrId(
  handle: string
): Promise<User | null> {
  const raw = handle.trim();
  if (!raw) return null;
  const username = raw.toLowerCase();

  if (username.length <= 15) {
    const byName = await getDocs(
      query(usersCollection, where('username', '==', username), limit(1))
    );
    if (!byName.empty) return byName.docs[0].data();
  }

  const byId = await getDoc(doc(usersCollection, raw));
  return byId.exists() ? byId.data() : null;
}

export async function loadUsersByIds(
  ids: string[]
): Promise<Map<string, User>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, User>();

  for (let index = 0; index < unique.length; index += 10) {
    const chunk = unique.slice(index, index + 10);
    const snapshot = await getDocs(
      query(usersCollection, where(documentId(), 'in', chunk))
    );
    snapshot.docs.forEach((docSnapshot) => {
      map.set(docSnapshot.id, docSnapshot.data());
    });
  }

  return map;
}
