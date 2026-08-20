import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { usersCollection } from '@lib/firebase/collections';

declare global {
  interface Window {
    AiteNative?: {
      isNativeApp?: () => boolean;
      getFcmToken?: () => string | null;
      subscribeTopic?: (topic: string) => void;
      refreshToken?: () => void;
    };
    __aiteFcmToken?: string;
  }
}

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!window.AiteNative?.isNativeApp?.();
}

export function getNativeFcmToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AiteNative?.getFcmToken?.() ??
    window.__aiteFcmToken ??
    localStorage.getItem('aite:fcmToken')
  );
}

/** يسجّل توكن إشعارات التطبيق الأصلي (FCM) في مستند المستخدم */
export async function registerNativePushToken(userId: string): Promise<void> {
  if (!isNativeApp()) return;

  window.AiteNative?.refreshToken?.();
  const token = getNativeFcmToken();
  if (!token) return;

  try {
    await updateDoc(doc(usersCollection, userId), {
      fcmTokens: arrayUnion(token)
    });
  } catch {
    /* التوكن يُعاد تسجيله عند الحدث التالي */
  }

  window.AiteNative?.subscribeTopic?.('all');
}
