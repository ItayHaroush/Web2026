import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { AndroidSettings, IOSSettings, NativeSettings } from 'capacitor-native-settings';

const PERMISSION_GRANTED = 'granted';

/** מזהה ערוץ ההתראות לכל הזמנה חדשה — חייב להתאים ל-channel_id שהשרת שולח ב-FCM */
export const ORDERS_CHANNEL_ID = 'orders';

export function isNativePushPlatform() {
    return Capacitor.isNativePlatform();
}

/** מחזיר 'android' | 'ios' | 'web' — נשלח לשרת כדי לבחור מבנה הודעת FCM נכון */
export function getPushPlatform() {
    try {
        return Capacitor.getPlatform();
    } catch {
        return 'web';
    }
}

/**
 * יוצר את ערוץ ההתראות "orders" ברמת חשיבות מקסימלית (Heads-up + צליל).
 * חובה כדי שהתראה תוצג כשהאפליקציה ברקע/סגורה. בטוח לקרוא כמה פעמים.
 */
export async function ensureNativeNotificationChannel() {
    if (!isNativePushPlatform()) return;
    try {
        await PushNotifications.createChannel({
            id: ORDERS_CHANNEL_ID,
            name: 'הזמנות חדשות',
            description: 'התראה על כל הזמנה חדשה שמתקבלת',
            importance: 5, // MAX — heads-up
            visibility: 1, // PUBLIC
            vibration: true,
            lights: true,
        });
    } catch (err) {
        console.warn('[Native Push] createChannel failed', err?.message || err);
    }
}

/**
 * מאזין ללחיצה על התראה (כשהאפליקציה ברקע/סגורה) ומעביר את data ל-handler
 * כדי לנווט למסך הרלוונטי. מחזיר פונקציית unsubscribe.
 */
export function listenNativeNotificationTaps(handler) {
    if (!isNativePushPlatform()) return () => {};

    const subPromise = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        try {
            handler(action?.notification?.data || {});
        } catch (err) {
            console.warn('[Native Push] tap handler failed', err?.message || err);
        }
    });

    return () => {
        Promise.allSettled([subPromise.then((sub) => sub.remove()).catch(() => {})]);
    };
}

/** בדיקת מצב הרשאת התראות הנוכחי: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' */
export async function getNativePushPermissionState() {
    if (!isNativePushPlatform()) return 'granted';
    try {
        const perm = await PushNotifications.checkPermissions();
        return perm.receive;
    } catch {
        return 'denied';
    }
}

/**
 * מבקש הרשאת התראות (מציג דיאלוג מערכת רק אם עוד לא הוחלט). מחזיר את המצב הסופי.
 */
export async function requestNativePushPermission() {
    if (!isNativePushPlatform()) return 'granted';
    try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
            perm = await PushNotifications.requestPermissions();
        }
        return perm.receive;
    } catch {
        return 'denied';
    }
}

/**
 * פותח את מסך הגדרות ההתראות של האפליקציה (כשההרשאה נדחתה ויש לאפשר ידנית).
 */
export async function openAppNotificationSettings() {
    if (!isNativePushPlatform()) return;
    try {
        await NativeSettings.open({
            optionAndroid: AndroidSettings.AppNotification,
            optionIOS: IOSSettings.App,
        });
    } catch (err) {
        console.warn('[Native Push] open settings failed', err?.message || err);
    }
}

export async function requestNativePushToken() {
    if (!isNativePushPlatform()) return null;

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== PERMISSION_GRANTED) {
        perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== PERMISSION_GRANTED) {
        return null;
    }

    return new Promise((resolve) => {
        let done = false;
        const timeout = setTimeout(() => {
            if (!done) {
                done = true;
                cleanup();
                resolve(null);
            }
        }, 10000);

        const regSubPromise = PushNotifications.addListener('registration', (token) => {
            if (done) return;
            done = true;
            cleanup();
            resolve(token?.value || null);
        });

        const errSubPromise = PushNotifications.addListener('registrationError', (err) => {
            console.error('[Native Push] registration error', err);
            if (done) return;
            done = true;
            cleanup();
            resolve(null);
        });

        const cleanup = () => {
            clearTimeout(timeout);
            Promise.allSettled([
                regSubPromise.then((sub) => sub.remove()).catch(() => {}),
                errSubPromise.then((sub) => sub.remove()).catch(() => {}),
            ]);
        };

        PushNotifications.register().catch((err) => {
            console.error('[Native Push] register failed', err);
            if (done) return;
            done = true;
            cleanup();
            resolve(null);
        });
    });
}

export async function getNativePushTokenIfPermitted() {
    if (!isNativePushPlatform()) return null;
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== PERMISSION_GRANTED) {
        return null;
    }
    return requestNativePushToken();
}

export async function disableNativePush() {
    if (!isNativePushPlatform()) return;
    try {
        await PushNotifications.removeAllListeners();
    } catch {
        // ignore
    }
}

export function listenNativeForegroundMessages(handler) {
    if (!isNativePushPlatform()) return () => {};

    const receivedSubPromise = PushNotifications.addListener('pushNotificationReceived', (notification) => {
        handler({
            notification: {
                title: notification?.title,
                body: notification?.body,
            },
            data: notification?.data || {},
        });
    });

    return () => {
        Promise.allSettled([receivedSubPromise.then((sub) => sub.remove()).catch(() => {})]);
    };
}
