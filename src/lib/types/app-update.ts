import type { Timestamp, FirestoreDataConverter } from 'firebase/firestore';

export type AppUpdateTarget = 'all' | 'android' | 'web';

export type AppUpdate = {
  id: string;
  active: boolean;
  force: boolean;
  versionName: string;
  versionCode: number;
  title: string;
  message: string;
  apkUrl: string | null;
  target: AppUpdateTarget;
  createdAt: Timestamp | null;
};

export const appUpdateConverter: FirestoreDataConverter<AppUpdate> = {
  toFirestore(data) {
    const value = { ...data } as Record<string, unknown>;
    delete value.id;
    return value;
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      active: false,
      force: false,
      versionName: '',
      versionCode: 0,
      title: 'تحديث جديد',
      message: '',
      apkUrl: null,
      target: 'all',
      createdAt: null,
      ...data
    } as AppUpdate;
  }
};
