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
const VAPID_KEY = 'BGbVAlRKn9V7VrOB9aN8-lAoZ9_q55ox6-pgJ0p7dN9uGPQl6t60ZiJwCzmZj_P2BHmGuMTSMjChxMOJAccvG-o';

export async function requestFcmToken() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    console.log('VAPID', VAPID_KEY, VAPID_KEY.length);

    // Register and wait until the SW is active to avoid "no active Service Worker" errors
    let swReg;
    try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    } catch (err) {
        console.error('[FCM] SW register failed', err);
        throw err;
    }

    const readyReg = await navigator.serviceWorker.ready;
    const swUrl = readyReg?.active?.scriptURL || swReg?.active?.scriptURL;
    console.log('[FCM] using SW', swUrl || '(no scriptURL yet)');

    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: readyReg || swReg,
    });
    return token;
}

export function listenForegroundMessages(handler) {
    return onMessage(messaging, handler);
}
