import { useEffect, useRef, useState, useCallback } from 'react';
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
function isRestaurantOrderAlertsMuted(user, impersonating) {
    try {
        if (localStorage.getItem('isPreviewMode') === 'true') return true;
    } catch {
        /* ignore */
    }
    // סופר־אדמין ללא התחזות למסעדה — אין צלצולי הזמנות מטבח (רק דשבורד מערכת / FCM נפרד)
    if (user?.is_super_admin === true && !impersonating) return true;
    return false;
}

export default function AdminNotificationProvider({ children }) {
    const { user, getAuthHeaders, impersonating } = useAdminAuth();
    const navigate = useNavigate();
    const lastFcmMessageIdsRef = useRef(new Set());
    const fcmNotifCountRef = useRef(0);
    const lastKnownOrderCountRef = useRef(null);
    const lastPollTenantRef = useRef(null);

    // באנר אישור הזמנה (מצב "עד קבלה")
    const [ackBanner, setAckBanner] = useState(null); // { orderId, stopFn }
    const stopFnRef = useRef(null); // מאחסן את stopFn הפעיל

    const triggerAlert = useCallback((orderId) => {
        // עצור צלצול קודם
        if (stopFnRef.current) { stopFnRef.current(); stopFnRef.current = null; }
        const stopFn = SoundManager.playAlert();
        stopFnRef.current = stopFn;
        // הצג באנר רק במצב "עד קבלה"
        if (SoundManager.getRingMode() === 'acknowledge') {
            setAckBanner({ orderId, stopFn });
        }
    }, []);

    const dismissAckBanner = useCallback(() => {
        if (stopFnRef.current) { stopFnRef.current(); stopFnRef.current = null; }
        setAckBanner(null);
    }, []);

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
        if (isSuperAdmin && !impersonating) return;

        let isFirstPoll = true;
        let cancelled = false;
        const poll = async () => {
            if (cancelled) return;
            const alertsMuted = isRestaurantOrderAlertsMuted(user, impersonating);
            let pollTenant = '';
            try {
                pollTenant = localStorage.getItem('tenantId') || '';
            } catch {
                pollTenant = '';
            }
            if (lastPollTenantRef.current !== pollTenant) {
                lastPollTenantRef.current = pollTenant;
                lastKnownOrderCountRef.current = null;
            }
            try {
                const res = await api.get('/admin/orders?per_page=1', { headers: getAuthHeaders() });
                if (cancelled) return;
                const orders = res.data?.orders?.data || res.data?.orders || [];
                const latestOrder = orders[0];
                const latestId = latestOrder?.id ?? null;
                const prevKnownId = lastKnownOrderCountRef.current;
                if (latestId && prevKnownId !== null && latestId > prevKnownId) {
                    const isFuturePending = latestOrder?.is_future_order &&
                        (latestOrder?.status === 'pending' || latestOrder?.status === 'awaiting_payment');
                    if (!alertsMuted && !isFirstPoll && !isFuturePending) {
                        triggerAlert(latestId);
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
    }, [user, getAuthHeaders, impersonating, triggerAlert]);

    // FCM — צלצול רק ל-new_order (רק למשתמשי אדמין)
    useEffect(() => {
        if (!user) return undefined;
        const role = user.role || '';
        const isSuperAdmin = user.is_super_admin === true;
        if (!isSuperAdmin && !['owner', 'manager', 'employee'].includes(role)) return undefined;
        if (isSuperAdmin && !impersonating) return undefined;

        // האזנה ל-postMessage מ-Service Worker (כשהאפליקציה פתוחה)
        const unsubSw = SoundManager.listenServiceWorkerMessages((payload) => {
            if (isRestaurantOrderAlertsMuted(user, impersonating)) return;
            const title = payload?.notification?.title || payload?.data?.title || PRODUCT_NAME;
            const body = payload?.notification?.body || payload?.data?.body || 'הזמנה חדשה';
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try { new Notification(title, { body, icon: '/icon-192.png', silent: true }); } catch (_) { }
            }
            triggerAlert(payload?.data?.orderId);
        }, {
            shouldPlayOrderSound: () => false, // triggerAlert handles sound
        });

        const unsubscribe = listenForegroundMessages((payload) => {
            const alertsMuted = isRestaurantOrderAlertsMuted(user, impersonating);

            const msgId = payload?.messageId || payload?.data?.messageId || payload?.data?.google?.message_id;
            if (msgId) {
                if (lastFcmMessageIdsRef.current.has(msgId)) return;
                lastFcmMessageIdsRef.current.add(msgId);
                setTimeout(() => lastFcmMessageIdsRef.current.delete(msgId), 30_000);
            }

            const dataType = payload?.data?.type;

            // future_order_created — תמיד לרענן דשבורד; בלי צלצול (גם בתצוגה מקדימה)
            if (dataType === 'future_order_created') {
                try {
                    window.dispatchEvent(new CustomEvent('takeeat:future-order-created', {
                        detail: { orderId: payload?.data?.orderId },
                    }));
                } catch { /* ignore */ }
                return;
            }

            if (alertsMuted) {
                return;
            }

            if (dataType === 'new_order') {
                triggerAlert(payload?.data?.orderId);
            }

            const title = payload?.notification?.title || payload?.data?.title || PRODUCT_NAME;
            const body = payload?.notification?.body || payload?.data?.body || 'התראה חדשה';

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
    }, [user, impersonating, navigate, triggerAlert]);

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

    return (
        <>
            {children}
            {/* באנר "עד קבלת הזמנה" — מוצג רק במצב acknowledge */}
            {ackBanner && (
                <div
                    dir="rtl"
                    style={{
                        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 99999, display: 'flex', alignItems: 'center', gap: 14,
                        background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',
                        border: '2px solid #f97316', borderRadius: 16,
                        padding: '14px 22px', boxShadow: '0 8px 32px rgba(249,115,22,0.35)',
                        animation: 'takeeat-ack-pulse 1.2s ease-in-out infinite alternate',
                        minWidth: 280, maxWidth: '90vw',
                    }}
                >
                    <style>{`
                        @keyframes takeeat-ack-pulse {
                            from { box-shadow: 0 8px 32px rgba(249,115,22,0.35); }
                            to   { box-shadow: 0 8px 48px rgba(249,115,22,0.7); }
                        }
                    `}</style>
                    <span style={{ fontSize: 26 }}>🔔</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: '#f97316', fontWeight: 900, fontSize: 15, lineHeight: 1.2 }}>
                            הזמנה חדשה!
                        </div>
                        {ackBanner.orderId && (
                            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                                הזמנה #{ackBanner.orderId}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={dismissAckBanner}
                        style={{
                            background: '#f97316', color: '#fff', border: 'none', borderRadius: 10,
                            padding: '8px 18px', fontWeight: 900, fontSize: 14, cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        קיבלתי ✓
                    </button>
                </div>
            )}
        </>
    );
}
