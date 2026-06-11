import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const PERMISSION_GRANTED = 'granted';

export function isNativePushPlatform() {
    return Capacitor.isNativePlatform();
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
