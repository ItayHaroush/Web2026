import { initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getFirebaseMessagingSwUrl } from '../utils/deployVersion.js';
import {
    disableNativePush,
    getNativePushTokenIfPermitted,
    isNativePushPlatform,
    listenNativeForegroundMessages,
    requestNativePushToken,
} from './nativePush';

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

const VAPID_KEY = 'BGbVAlRKn9V7VrOB9aN8-lAoZ9_q55ox6-pgJ0p7dN9uGPQl6t60ZiJwCzmZj_P2BHmGuMTSMjChxMOJAccvG-o';

// ⚠️ CRITICAL: Firebase Messaging MUST be initialized lazily.
// getMessaging() synchronously runs `navigator.serviceWorker.addEventListener(...)`.
// In the Facebook/Instagram in-app browser (especially iOS WKWebView) and other
// restricted WebViews, `navigator.serviceWorker` is `undefined`, so calling it at
// module load time throws a TypeError and crashes the entire app at boot (white screen).
// We therefore defer initialization and only create the Messaging instance once we have
// confirmed the browser actually supports web push.
let firebaseApp;
let messagingPromise;

function getFirebaseApp() {
    if (!firebaseApp) {
        firebaseApp = initializeApp(firebaseConfig);
    }
    return firebaseApp;
}

/**
 * מחזיר instance של Firebase Messaging, או null כשהדפדפן לא תומך ב-web push
 * (פייסבוק/אינסטגרם in-app, WebView ישן, מצב פרטי וכו') — כדי שהקריאה לא תקרוס.
 * הבדיקה רצה פעם אחת בלבד וממומשת (memoized).
 */
async function getMessagingSafe() {
    if (messagingPromise === undefined) {
        messagingPromise = (async () => {
            try {
                if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
                if (isNativePushPlatform()) return null;
                if (isFacebookBrowser()) return null;
                // Required Web Push primitives — absent in FB/IG IAB & older WebViews.
                if (!('serviceWorker' in navigator)) return null;
                if (!('Notification' in window)) return null;
                if (!('PushManager' in window)) return null;
                // Firebase's own async capability probe (IndexedDB openable, etc.).
                const supported = await isSupported().catch(() => false);
                if (!supported) return null;
                return getMessaging(getFirebaseApp());
            } catch (err) {
                console.warn('[FCM] Messaging unavailable in this browser:', err?.message || err);
                return null;
            }
        })();
    }
    return messagingPromise;
}

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

export { isNativePushPlatform };

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
    if (isNativePushPlatform()) {
        const token = await requestNativePushToken();
        try {
            if (token) {
                localStorage.setItem(CUSTOMER_LS_KEY, token);
            }
        } catch {
            // ignore
        }
        return token;
    }

    const messaging = await getMessagingSafe();
    if (!messaging) {
        return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        return null;
    }

    let swReg;
    try {
        swReg = await navigator.serviceWorker.register(getFirebaseMessagingSwUrl(), { scope: '/' });
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
    if (isNativePushPlatform()) {
        const token = await getNativePushTokenIfPermitted();
        try {
            if (token) {
                localStorage.setItem(CUSTOMER_LS_KEY, token);
            }
        } catch {
            // ignore
        }
        return token;
    }

    const messaging = await getMessagingSafe();
    if (!messaging) {
        return null;
    }
    if (Notification.permission !== 'granted') {
        return null;
    }

    let swReg;
    try {
        swReg = await navigator.serviceWorker.register(getFirebaseMessagingSwUrl(), { scope: '/' });
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

/**
 * טוקן FCM למנהלים/טאבלט (אותו מפתח LS_KEY) — בלי לבקש הרשאה מחדש.
 * לשימוש אחרי התחברות מחדש כשהרשאת הדפדפן כבר granted.
 */
export async function getAdminFcmTokenIfPermitted() {
    if (isNativePushPlatform()) {
        const token = await getNativePushTokenIfPermitted();
        if (token) setStoredFcmToken(token);
        return token;
    }

    const messaging = await getMessagingSafe();
    if (!messaging) {
        return null;
    }
    if (Notification.permission !== 'granted') {
        return null;
    }

    let swReg;
    try {
        swReg = await navigator.serviceWorker.register(getFirebaseMessagingSwUrl(), { scope: '/' });
    } catch (err) {
        console.error('[FCM admin] SW register failed', err);
        return null;
    }

    const readyReg = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: readyReg || swReg,
    });
    if (token) setStoredFcmToken(token);
    return token;
}

export async function requestFcmToken() {
    if (isNativePushPlatform()) {
        const token = await requestNativePushToken();
        if (token) setStoredFcmToken(token);
        return token;
    }

    // Returns null in Facebook/Instagram browsers and anywhere web push is unsupported.
    const messaging = await getMessagingSafe();
    if (!messaging) {
        return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // Register and wait until the SW is active to avoid "no active Service Worker" errors
    let swReg;
    try {
        swReg = await navigator.serviceWorker.register(getFirebaseMessagingSwUrl(), { scope: '/' });
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
    if (isNativePushPlatform()) {
        try {
            await disableNativePush();
        } finally {
            clearStoredFcmToken();
        }
        return true;
    }

    const messaging = await getMessagingSafe();
    if (!messaging) {
        clearStoredFcmToken();
        return true;
    }

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
    if (isNativePushPlatform()) {
        return listenNativeForegroundMessages(handler);
    }

    // Messaging may be unsupported (FB/IG in-app, older WebViews) — degrade to a no-op
    // unsubscribe while still resolving lazily so we never crash the caller's effect.
    let unsubscribe = () => { };
    let cancelled = false;

    getMessagingSafe().then((messaging) => {
        if (cancelled || !messaging) return;
        try {
            unsubscribe = onMessage(messaging, handler);
        } catch (err) {
            console.warn('[FCM] onMessage subscription failed:', err?.message || err);
        }
    });

    return () => {
        cancelled = true;
        try {
            unsubscribe();
        } catch {
            // ignore
        }
    };
}
