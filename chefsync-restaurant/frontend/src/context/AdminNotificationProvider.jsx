import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthContext';
import api from '../services/apiClient';
import { listenForegroundMessages } from '../services/fcm';
import SoundManager from '../services/SoundManager';
import { PRODUCT_NAME } from '../constants/brand';

/**
 * AdminNotificationProvider — קומפוננטה שיושבת ברמת App (מעל הראוטר של אדמין)
 * ולא מתבצע לה remount בכל ניווט בין דפים.
 *
 * אחראית על:
 * 1. פתיחת נעילת אודיו (PWA)
 * 2. פולינג גיבוי כל 15 שניות לזיהוי הזמנות חדשות
 * 3. האזנה ל-FCM foreground messages
 * 4. האזנה ל-postMessage מ-Service Worker
 * 5. ניקוי badge כשהחלון חוזר לפוקוס
 */
export default function AdminNotificationProvider({ children }) {
    const { user, getAuthHeaders } = useAdminAuth();
    const navigate = useNavigate();
    const lastFcmMessageIdsRef = useRef(new Set());
    const fcmNotifCountRef = useRef(0);
    const lastKnownOrderCountRef = useRef(null);

    // חסימת צלצולים ב-5 שניות הראשונות אחרי אתחול/ריענון
    // מונע צלצולי שווא מ-FCM/SW/polling שמתעוררים בזמן טעינה
    useEffect(() => {
        SoundManager.setMuteUntil(Date.now() + 5000);
        return () => { SoundManager.setMuteUntil(0); };
    }, []);

    // פתיחת נעילת אודיו בלחיצה ראשונה (חובה ב-PWA)
    useEffect(() => {
        SoundManager.setupAutoUnlock();
    }, []);

    // ===== גיבוי: פולינג כל 15 שניות לזיהוי הזמנות חדשות =====
    useEffect(() => {
        if (!user) return;
        // פולינג רק עבור משתמשי אדמין (לא לקוחות/ללא תפקיד)
        const role = user.role || '';
        const isSuperAdmin = user.is_super_admin === true;
        if (!isSuperAdmin && !['owner', 'manager', 'employee'].includes(role)) return;

        let isFirstPoll = true;
        let cancelled = false;
        const poll = async () => {
            if (cancelled) return;
            try {
                const res = await api.get('/admin/orders?per_page=1', { headers: getAuthHeaders() });
                if (cancelled) return;
                const orders = res.data?.orders?.data || res.data?.orders || [];
                const latestId = orders[0]?.id ?? null;
                if (latestId && lastKnownOrderCountRef.current !== null && latestId > lastKnownOrderCountRef.current) {
                    if (!isFirstPoll) {
                        SoundManager.play();
                        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            try { new Notification('הזמנה חדשה', { body: `הזמנה #${latestId}`, icon: '/icon-192.png', silent: true }); } catch (_) { }
                        }
                    }
                }
                if (latestId) {
                    lastKnownOrderCountRef.current = latestId;
                    try { sessionStorage.setItem('lastKnownOrderId', String(latestId)); } catch (_) { }
                }
                isFirstPoll = false;
            } catch (_) { /* silent — 401 תיתפס כאן ולא תגיע ל-interceptor */ }
        };
        poll();
        const interval = setInterval(poll, 15_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [user, getAuthHeaders]);

    // FCM — צלצול רק ל-new_order (רק למשתמשי אדמין)
    useEffect(() => {
        if (!user) return undefined;
        const role = user.role || '';
        const isSuperAdmin = user.is_super_admin === true;
        if (!isSuperAdmin && !['owner', 'manager', 'employee'].includes(role)) return undefined;

        // האזנה ל-postMessage מ-Service Worker (כשהאפליקציה פתוחה)
        const unsubSw = SoundManager.listenServiceWorkerMessages((payload) => {
            const title = payload?.notification?.title || payload?.data?.title || PRODUCT_NAME;
            const body = payload?.notification?.body || payload?.data?.body || 'הזמנה חדשה';
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try { new Notification(title, { body, icon: '/icon-192.png', silent: true }); } catch (_) { }
            }
        });

        const unsubscribe = listenForegroundMessages((payload) => {
            const msgId = payload?.messageId || payload?.data?.messageId || payload?.data?.google?.message_id;
            if (msgId) {
                if (lastFcmMessageIdsRef.current.has(msgId)) return;
                lastFcmMessageIdsRef.current.add(msgId);
                setTimeout(() => lastFcmMessageIdsRef.current.delete(msgId), 30_000);
            }

            const dataType = payload?.data?.type;
            if (dataType === 'new_order') {
                SoundManager.play();
            }

            const title = payload?.notification?.title || payload?.data?.title || PRODUCT_NAME;
            const body = payload?.notification?.body || payload?.data?.body || 'התראה חדשה';

            // future_order_created — בלי חלון מערכת; צלצול כבר מדולג
            if (dataType === 'future_order_created') {
                return;
            }

            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try {
                    const n = new Notification(title, { body, icon: '/icon-192.png', silent: true });
                    n.onclick = () => {
                        n.close();
                        window.focus();
                        fcmNotifCountRef.current = Math.max(0, fcmNotifCountRef.current - 1);
                        if (fcmNotifCountRef.current > 0) {
                            if (navigator.setAppBadge) navigator.setAppBadge(fcmNotifCountRef.current).catch(() => { });
                        } else if (navigator.clearAppBadge) {
                            navigator.clearAppBadge().catch(() => { });
                        }
                        const url = payload?.data?.url;
                        if (url && typeof url === 'string' && url.startsWith('/')) {
                            navigate(url);
                        } else if (payload?.data?.orderId) {
                            navigate('/admin/orders');
                        }
                    };
                    fcmNotifCountRef.current += 1;
                    if (navigator.setAppBadge) navigator.setAppBadge(fcmNotifCountRef.current).catch(() => { });
                } catch (e) {
                    console.warn('[FCM] Notification() failed', e);
                }
            }
        });
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
            unsubSw();
        };
    }, [user, navigate]);

    // ניקוי badge כשחוזרים לפוקוס
    useEffect(() => {
        const clearBadge = () => {
            if (document.visibilityState === 'visible') {
                fcmNotifCountRef.current = 0;
                if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => { });
            }
        };
        clearBadge();
        document.addEventListener('visibilitychange', clearBadge);
        return () => document.removeEventListener('visibilitychange', clearBadge);
    }, []);

    return children;
}
