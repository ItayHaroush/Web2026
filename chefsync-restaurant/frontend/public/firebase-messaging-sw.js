/* eslint-disable no-undef */
// Basic lifecycle logs to verify the SW is installed on the frontend domain
self.addEventListener('install', () => {
    console.log('🔥 FCM Service Worker installed');
});

self.addEventListener('activate', () => {
    console.log('✅ FCM Service Worker activated');
});

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyAdhvtnnmHu8u294TeLUz2Vl7tTdg64bSw',
    authDomain: 'chefsync-takeeat.firebaseapp.com',
    projectId: 'chefsync-takeeat',
    storageBucket: 'chefsync-takeeat.firebasestorage.app',
    messagingSenderId: '269892843693',
    appId: '1:269892843693:web:24054f3b046a2c40f16e24',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(async (payload) => {
    // Avoid duplicates: if there's an active/focused client, let the page handle it.
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasFocusedClient = windowClients.some((c) => c.focused || c.visibilityState === 'visible');

    if (hasFocusedClient) {
        for (const c of windowClients) {
            try {
                c.postMessage({ type: 'fcm_message', payload });
            } catch (_) {
                // ignore
            }
        }
        return;
    }

    const title = payload.notification?.title || payload.data?.title || 'TakeEat';
    const body = payload.notification?.body || payload.data?.body || 'התראה חדשה';

    await self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/badge-72x72.png',
        data: payload.data || {},
    });

    // PWA App Badge – show the actual count of active notifications
    if (self.navigator?.setAppBadge) {
        const all = await self.registration.getNotifications();
        self.navigator.setAppBadge(all.length).catch(() => { });
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification?.data?.url || '/';

    event.waitUntil(
        (async () => {
            // Update badge to remaining notification count (or clear if none left)
            if (self.navigator?.setAppBadge) {
                const remaining = await self.registration.getNotifications();
                if (remaining.length > 0) {
                    self.navigator.setAppBadge(remaining.length).catch(() => { });
                } else {
                    self.navigator.clearAppBadge().catch(() => { });
                }
            }

            const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
            for (const client of allClients) {
                if ('focus' in client) {
                    client.focus();
                    return;
                }
            }
            if (clients.openWindow) {
                await clients.openWindow(url);
            }
        })()
    );
});
