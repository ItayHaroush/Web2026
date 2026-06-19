import { useEffect, useRef } from 'react';
import { listenForegroundMessages } from '../services/fcm';
import SoundManager from '../services/SoundManager';

export default function useSuperAdminForegroundFcm(enabled) {
    const lastMessageIdsRef = useRef(new Set());
    const notifCountRef = useRef(0);

    useEffect(() => {
        if (!enabled) return undefined;

        const unsubscribe = listenForegroundMessages((payload) => {
            const msgId = payload?.messageId || payload?.data?.messageId || payload?.data?.google?.message_id;
            if (msgId) {
                if (lastMessageIdsRef.current.has(msgId)) return;
                lastMessageIdsRef.current.add(msgId);
                setTimeout(() => lastMessageIdsRef.current.delete(msgId), 30_000);
            }

            const title = payload?.notification?.title || payload?.data?.title || 'TakeEat';
            const body = payload?.notification?.body || payload?.data?.body || 'התראה חדשה';
            const dataType = payload?.data?.type;

            if (dataType === 'new_order') {
                SoundManager.play();
            }

            if (Notification?.permission === 'granted') {
                try {
                    const n = new Notification(title, { body, icon: '/icon-192.png', silent: true });
                    n.onclick = () => {
                        n.close();
                        window.focus();
                        notifCountRef.current = Math.max(0, notifCountRef.current - 1);
                        if (notifCountRef.current > 0) {
                            if (navigator.setAppBadge) navigator.setAppBadge(notifCountRef.current).catch(() => {});
                        } else if (navigator.clearAppBadge) {
                            navigator.clearAppBadge().catch(() => {});
                        }
                    };
                    notifCountRef.current += 1;
                    if (navigator.setAppBadge) navigator.setAppBadge(notifCountRef.current).catch(() => {});
                } catch (e) {
                    console.warn('[FCM] Notification() failed', e);
                }
            }
        });

        const clearBadge = () => {
            if (document.visibilityState === 'visible') {
                notifCountRef.current = 0;
                if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
            }
        };
        clearBadge();
        document.addEventListener('visibilitychange', clearBadge);

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
            document.removeEventListener('visibilitychange', clearBadge);
        };
    }, [enabled]);
}
