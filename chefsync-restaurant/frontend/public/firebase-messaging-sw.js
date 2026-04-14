/* eslint-disable no-undef */
// Basic lifecycle logs to verify the SW is installed on the frontend domain
self.addEventListener('install', () => {
    console.log('🔥 FCM Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('✅ FCM Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// ===== שכבה ראשונה: push ישיר — הכי אמין, עובד לפני Firebase =====
// נורה תמיד כש-push מגיע, גם ב-PWA standalone.
// שולח postMessage לכל החלונות הפתוחים כדי שהדף ישמיע צלצול.
self.addEventListener('push', (event) => {
    let data = null;
    try { data = event.data?.json?.(); } catch (_) { /* ignore */ }
    if (!data) return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const c of windowClients) {
                try {
                    c.postMessage({ type: 'fcm_push', data: data.data || data });
                } catch (_) { /* ignore */ }
            }
        })
    );
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
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasFocusedClient = windowClients.some((c) => c.focused || c.visibilityState === 'visible');

    // תמיד שלח postMessage לכל הלקוחות — גם כשהם "ברקע" ב-PWA
    // (במצב standalone הדפדפן לפעמים לא מזהה את הלקוח כ-focused)
    for (const c of windowClients) {
        try {
            c.postMessage({ type: 'fcm_message', payload });
        } catch (_) {
            // ignore
        }
    }

    // הצג system notification רק אם אין לקוח פעיל (באמת ברקע)
    if (!hasFocusedClient) {
        const title = payload.notification?.title || payload.data?.title || 'TakeEat';
        const body = payload.notification?.body || payload.data?.body || 'התראה חדשה';

        await self.registration.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/badge-72x72.png',
            silent: true,
            data: payload.data || {},
        });

        if (self.navigator?.setAppBadge) {
            const all = await self.registration.getNotifications();
            self.navigator.setAppBadge(all.length).catch(() => { });
        }
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
