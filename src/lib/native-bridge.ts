import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getFirebase } from '@lib/firebase/app';
import { usersCollection } from '@lib/firebase/collections';

// مفتاح VAPID العام لإشعارات الويب (PWA)
const VAPID_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  process.env.FIREBASE_VAPID_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  '';

/** هل التطبيق يعمل كتطبيق مثبّت (PWA) أو داخل متصفح */
export function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

/** طلب إذن الإشعارات */
async function ensurePermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

/** يسجّل توكن Web Push (FCM) للمتصفح أو تطبيق PWA المثبّت. */
export async function registerWebPushToken(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const granted = await ensurePermission();
    if (!granted) return;

    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' }
    );

    const app = getFirebase().firebaseApp;
    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY || undefined,
      serviceWorkerRegistration: registration
    });

    if (token) {
      await updateDoc(doc(usersCollection, userId), {
        fcmTokens: arrayUnion(token)
      });
      localStorage.setItem('aite:fcmToken', token);
    }

    // إشعارات أثناء فتح التطبيق (المقدمة)
    void onMessage(messaging, (payload) => {
      const title =
        payload.notification?.title || payload.data?.title || 'Aite';
      const body = payload.notification?.body || payload.data?.body || '';
      const image = payload.data?.image;
      if (Notification.permission === 'granted') {
        void registration.showNotification(title, {
          body,
          // صورة المرسل كأيقونة + بادج شعار Aite (مثل انستغرام)
          icon: image || '/logo192.png',
          badge: '/badge.png',
          tag: payload.data?.tag || 'aite',
          data: { url: payload.data?.url || '/notifications' },
          dir: 'rtl',
          lang: 'ar'
        });
      }
    });
  } catch {
    /* تُعاد المحاولة عند الجلسة التالية */
  }
}
