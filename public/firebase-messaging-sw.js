/// <reference lib="webworker" />
/* eslint-disable no-undef */
// خدمة إشعارات FCM الخلفية لتطبيق PWA
importScripts(
  'https://www.gstatic.com/firebasejs/9.9.4/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/9.9.4/firebase-messaging-compat.js'
);

firebase.initializeApp({
  apiKey: 'AIzaSyAVCxXk6KQM9m--c5B973RJv-f1dlqVTJw',
  authDomain: 'aite-76.firebaseapp.com',
  projectId: 'aite-76',
  storageBucket: 'aite-76.firebasestorage.app',
  messagingSenderId: '260079907658',
  appId: '1:260079907658:web:17e5a988e4614c1424c7b3'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title =
    data.title ||
    (payload.notification && payload.notification.title) ||
    'Aite';
  const body =
    data.body || (payload.notification && payload.notification.body) || '';
  const url = data.url || '/notifications';

  self.registration.showNotification(title, {
    body,
    icon: data.image || '/logo192.png',
    badge: '/logo192.png',
    image: data.image || undefined,
    tag: data.tag || 'aite',
    renotify: true,
    data: { url },
    dir: 'rtl',
    lang: 'ar',
    vibrate: [300, 200, 300]
  });
});

// فتح الرابط المطلوب عند الضغط على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target =
    (event.notification.data && event.notification.data.url) ||
    '/notifications';
  if (target.charAt(0) === '/') target = self.location.origin + target;
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return clients.openWindow(target);
      })
  );
});

self.addEventListener('install', (event) => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
