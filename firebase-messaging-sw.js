/* ============================================================
   firebase-messaging-sw.js
   Firebase Cloud Messaging background notification handler.
   Must be at root / of the site.
   ============================================================ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyBrDdL_1nSZZxVUyAxi2N1dCK7pEEgiLN8",
  authDomain:        "zafer-partisi-a407b.firebaseapp.com",
  projectId:         "zafer-partisi-a407b",
  storageBucket:     "zafer-partisi-a407b.firebasestorage.app",
  messagingSenderId: "107383701317",
  appId:             "1:107383701317:web:0481a586e417d8f187082c"
});

const messaging = firebase.messaging();

// Background message handler (app is in background / closed)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Zafer Partisi';
  const body  = payload.notification?.body  || '';
  const icon  = payload.notification?.icon  || '/assets/icons/icon-192.png';

  self.registration.showNotification(title, {
    body,
    icon,
    badge:  '/assets/icons/icon-72.png',
    tag:    'zafer-partisi',
    renotify: true,
    data:   payload.data || {}
  });
});

// Notification click → focus or open the app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        if (list.length > 0) return list[0].focus();
        return clients.openWindow('/');
      })
  );
});
