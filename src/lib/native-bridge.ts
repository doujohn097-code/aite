/* eslint-disable import/no-unresolved, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getFirebase } from '@lib/firebase/app';
import { usersCollection } from '@lib/firebase/collections';

const VAPID_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  process.env.FIREBASE_VAPID_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  '';

export function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

async function ensurePermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

async function registerNativePushToken(userId: string): Promise<void> {
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.removeAllListeners();
  await PushNotifications.register();

  await PushNotifications.addListener('registration', ({ value }) => {
    void updateDoc(doc(usersCollection, userId), {
      fcmTokens: arrayUnion(value)
    });
  });

  await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (event) => {
      const url = (event.notification.data as { url?: string } | null)?.url;
      if (url && typeof window !== 'undefined') window.location.assign(url);
    }
  );
}

/** توكن الإشعارات القادم من تطبيق أندرويد الأصلي (عبر جسر WebView) */
function getNativeToken(): string | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as Window & { AiteAndroid?: { fcmToken?: string } })
    .AiteAndroid;
  return bridge?.fcmToken ?? null;
}

/** يحفظ توكن التطبيق الأصلي في حساب المستخدم */
export async function registerNativeToken(userId: string): Promise<boolean> {
  const token = getNativeToken();

  if (!token) return false;

  await updateDoc(doc(usersCollection, userId), {
    fcmTokens: arrayUnion(token)
  });

  return true;
}

/** يسجّل توكن Web Push (FCM) للمتصفح أو تطبيق PWA المثبّت. */
export async function registerWebPushToken(userId: string): Promise<void> {
  if (isNativeApp()) {
    await registerNativePushToken(userId);
    return;
  }

  if (typeof window === 'undefined') return;

  // داخل تطبيق أندرويد: الإشعارات أصلية عبر FCM — نحفظ توكن الجهاز فقط
  const nativeSaved = await registerNativeToken(userId).catch(() => false);

  if (nativeSaved) return;

  // قد يصل التوكن بعد تحميل الصفحة — ننصت للحدث القادم من التطبيق
  window.addEventListener(
    'aite-native-token',
    () => void registerNativeToken(userId).catch(() => undefined),
    { once: true }
  );
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

    void onMessage(messaging, (payload) => {
      const title =
        payload.notification?.title || payload.data?.title || 'Aite';
      const body = payload.notification?.body || payload.data?.body || '';
      const image = payload.data?.image;
      if (Notification.permission === 'granted') {
        void registration.showNotification(title, {
          body,
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
    // تُعاد المحاولة في الجلسة التالية
  }
}
