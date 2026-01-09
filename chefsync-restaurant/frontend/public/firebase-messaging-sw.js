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

messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    self.registration.showNotification(title || 'ChefSync', {
        body: body || 'התראה חדשה',
        icon: '/icon-192.png',
        badge: '/badge-72x72.png',
    });
});
