import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCt_0-bTv5hosPEC6vJB9rgzYcwhfSKS9Y",
  authDomain: "cdo-cricket-34853.firebaseapp.com",
  projectId: "cdo-cricket-34853",
  storageBucket: "cdo-cricket-34853.firebasestorage.app",
  messagingSenderId: "76828114572",
  appId: "1:76828114572:web:cd2d5436caac8ad37085a9"
};

const VAPID_KEY = "BHj-7Vbu80Nfsq-myLuTblTXBjpiHIXA92900rYJXW6ahUkTVAPeM05xUoKXwiSw3NoajVTCvmUI5QQwHYWwzmQ";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export async function initPushNotifications(apiRequest: Function): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Permission denied');
      return;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await apiRequest('POST', '/api/push-token', { token });
      console.log('[FCM] Token registered successfully');
    }

    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      if (title && Notification.permission === 'granted') {
        new Notification(title, {
          body: body || '',
          icon: '/icon.png',
        });
      }
    });

  } catch (e) {
    console.error('[FCM] Setup failed:', e);
  }
}
