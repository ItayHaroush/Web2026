import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: 'AIzaSyAdhvtnnmHu8u294TeLUz2Vl7tTdg64bSw',
    authDomain: 'chefsync-takeeat.firebaseapp.com',
    projectId: 'chefsync-takeeat',
    storageBucket: 'chefsync-takeeat.firebasestorage.app',
    messagingSenderId: '269892843693',
    appId: '1:269892843693:web:24054f3b046a2c40f16e24',
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const VAPID_KEY = 'joFmZrI-usNwqfh5fQVjAkB_tR2DchtVkZ7uJlwO5XQ';

export async function requestFcmToken() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // Register and wait until the SW is active to avoid "no active Service Worker" errors
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    const readyReg = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: readyReg || swReg,
    });
    return token;
}

export function listenForegroundMessages(handler) {
    return onMessage(messaging, handler);
}
