importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCt_0-bTv5hosPEC6vJB9rgzYcwhfSKS9Y",
  authDomain: "cdo-cricket-34853.firebaseapp.com",
  projectId: "cdo-cricket-34853",
  storageBucket: "cdo-cricket-34853.firebasestorage.app",
  messagingSenderId: "76828114572",
  appId: "1:76828114572:web:cd2d5436caac8ad37085a9"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body: body || '',
      icon: '/icon.png',
      badge: '/icon.png',
    });
  }
});
