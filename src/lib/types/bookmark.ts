import { Timestamp, type FirestoreDataConverter } from 'firebase/firestore';

export type Bookmark = {
  id: string;
  createdAt: Timestamp;
};

export const bookmarkConverter: FirestoreDataConverter<Bookmark> = {
  toFirestore(data) {
    const bookmark = { ...data } as Record<string, unknown>;
    delete bookmark.id;
    return bookmark;
  },
  fromFirestore(snapshot, options) {
    const { id } = snapshot;
    const data = snapshot.data(options);

    return { id, createdAt: Timestamp.now(), ...data } as Bookmark;
  }
};
