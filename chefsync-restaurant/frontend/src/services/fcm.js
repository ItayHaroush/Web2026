import { initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, onMessage } from 'firebase/messaging';

// ⚠️ CRITICAL: Detect Facebook/Instagram browsers that don't support Firebase
const isFacebookBrowser = () => {
    try {
        const ua = navigator.userAgent || navigator.vendor || window.opera || '';
        return /FBAN|FBAV|Instagram/i.test(ua);
    } catch {
        return false;
    }
};

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

const LS_KEY = 'fcmToken';
/** FCM ללקוחות קצה — נפרד מטוקן אדמין/טאבלט */
const CUSTOMER_LS_KEY = 'customer_fcm_token';

export function getStoredFcmToken() {
    try {
        return localStorage.getItem(LS_KEY);
    } catch {
        return null;
    }
}

function setStoredFcmToken(token) {
    try {
        if (token) localStorage.setItem(LS_KEY, token);
    } catch {
        // ignore
    }
}

export function clearStoredFcmToken() {
    try {
        localStorage.removeItem(LS_KEY);
    } catch {
        // ignore
    }
}

export function getStoredCustomerFcmToken() {
    try {
        return localStorage.getItem(CUSTOMER_LS_KEY);
    } catch {
        return null;
    }
}

export function clearStoredCustomerFcmToken() {
    try {
        localStorage.removeItem(CUSTOMER_LS_KEY);
    } catch {
        // ignore
    }
}

/**
 * רישום FCM עבור לקוח PWA (שומר מפתח נפרד מפאנל המסעדה).
 */
export async function requestCustomerFcmToken() {
    if (isFacebookBrowser()) {
        return null;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        return null;
    }

    let swReg;
    try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    } catch (err) {
        console.error('[FCM customer] SW register failed', err);
        throw err;
    }

    const readyReg = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: readyReg || swReg,
    });
    try {
        if (token) {
            localStorage.setItem(CUSTOMER_LS_KEY, token);
        }
    } catch {
        // ignore
    }
    return token;
}

/**
 * כשהרשאת התראות כבר granted — מביא טוקן בלי לפתוח דיאלוג חדש.
 */
export async function getCustomerFcmTokenIfPermitted() {
    if (isFacebookBrowser()) {
        return null;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return null;
    }
    if (Notification.permission !== 'granted') {
        return null;
    }

    let swReg;
    try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    } catch (err) {
        console.error('[FCM customer] SW register failed', err);
        return null;
    }

    const readyReg = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: readyReg || swReg,
    });
    try {
        if (token) {
            localStorage.setItem(CUSTOMER_LS_KEY, token);
        }
    } catch {
        // ignore
    }
    return token;
}

export async function requestFcmToken() {
    // ⚠️ Block Firebase operations in Facebook/Instagram browsers
    if (isFacebookBrowser()) {
        return null;
    }

    // Check if notifications are supported
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // Register and wait until the SW is active to avoid "no active Service Worker" errors
    let swReg;
    try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    } catch (err) {
        console.error('[FCM] SW register failed', err);
        throw err;
    }

    const readyReg = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: readyReg || swReg,
    });
    if (token) setStoredFcmToken(token);
    return token;
}

export async function disableFcm() {
    try {
        // This removes the FCM token from the browser (permission remains granted).
        const ok = await deleteToken(messaging);
        clearStoredFcmToken();
        return ok;
    } catch (e) {
        // Still clear local state; backend unregister will handle server-side.
        clearStoredFcmToken();
        throw e;
    }
}

export function listenForegroundMessages(handler) {
    return onMessage(messaging, handler);
}
