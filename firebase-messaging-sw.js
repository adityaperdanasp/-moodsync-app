importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA37TelLM0aPlOdoA9cvsUYKxtHxxUHcIc",
  authDomain: "moodsync-378bf.firebaseapp.com",
  projectId: "moodsync-378bf",
  storageBucket: "moodsync-378bf.firebasestorage.app",
  messagingSenderId: "344979040281",
  appId: "1:344979040281:web:7d2b6d2d6a7a429810a288"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'MoodSync';
  const body = payload.notification?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: 'https://em-content.zobj.net/source/apple/391/couple-with-heart_1f491.png',
    badge: 'https://em-content.zobj.net/source/apple/391/couple-with-heart_1f491.png'
  });
});
