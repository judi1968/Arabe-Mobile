// Service Worker pour Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging.js');

// Initialize Firebase (use the same config as in your app)
const firebaseConfig = {
  apiKey: "AIzaSyBvN43r8R_5BwurgJL29N-nDKUs5W5vuGs",
  authDomain: "arabe-8144d.firebaseapp.com",
  projectId: "arabe-8144d",
  storageBucket: "arabe-8144d.appspot.com",
  messagingSenderId: "560164445602",
  appId: "1:560164445602:web:f1b3f108f71df4d81026fb"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log('Push notification received:', data);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.', event);
  event.notification.close();
  
  // Optionally open a window/navigate
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
