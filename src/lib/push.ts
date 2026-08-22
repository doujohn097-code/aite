import { auth } from '@lib/firebase/app';

export type PushContext = 'post' | 'reel' | 'story';

/** إرسال إشعار فوري (FCM) عبر مسار الخادم — لا يعطّل الإجراء الأصلي أبدًا */
export function sendPushNotification(payload: Record<string, unknown>): void {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    void currentUser
      .getIdToken()
      .then((idToken) =>
        fetch('/api/push/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify(payload)
        })
      )
      .catch(() => undefined);
  } catch {
    /* الإشعار تحسين اختياري */
  }
}
