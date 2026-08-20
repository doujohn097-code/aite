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

  // التوكن قد يصل بعد لحظات من تحميل الصفحة — نعيد المحاولة عدة مرات
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = getNativeFcmToken();
    if (token) {
      try {
        await updateDoc(doc(usersCollection, userId), {
          fcmTokens: arrayUnion(token)
        });
      } catch {
        /* التوكن يُعاد تسجيله عند الحدث التالي */
      }
      window.AiteNative?.subscribeTopic?.('all');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
